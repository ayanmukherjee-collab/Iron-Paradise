-- Profiles, roles and the helper functions every RLS policy builds on.
--
-- Access is deny-by-default twice over: Supabase grants every new public table
-- to anon/authenticated, so we strip those grants and opt back in per table,
-- and RLS is enabled on each table in the same migration that creates it.

alter default privileges for role postgres in schema public
  revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke all on sequences from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke execute on functions from public, anon, authenticated;
-- Postgres grants EXECUTE on every new function to PUBLIC globally, and a
-- per-schema revoke cannot remove a global default, so revoke it globally.
alter default privileges for role postgres
  revoke execute on functions from public;

create type public.app_role as enum ('owner', 'manager', 'trainer', 'member', 'guest');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '' check (length(full_name) <= 120),
  email text,
  role public.app_role not null default 'guest',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
revoke all on table public.profiles from anon, authenticated;

create function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function public.touch_updated_at();

-- The caller's role, or null when they have no profile or were deactivated.
-- security definer so policies on profiles can call it without recursing
-- into profiles' own RLS.
create function public.current_app_role()
returns public.app_role
language sql
stable
security definer
set search_path = ''
as $$
  select role from public.profiles where id = auth.uid() and is_active;
$$;

create function public.has_role(variadic allowed public.app_role[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(public.current_app_role() = any (allowed), false);
$$;

create function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_role('owner', 'manager', 'trainer');
$$;

grant execute on function public.current_app_role() to authenticated;
grant execute on function public.has_role(public.app_role[]) to authenticated;
grant execute on function public.is_staff() to authenticated;

-- Everyone who signs in starts as a guest. The name comes from Google's
-- metadata for display only; the role never does.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, email)
  values (
    new.id,
    left(coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', ''), 120),
    new.email
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create policy "profiles: read own"
  on public.profiles for select to authenticated
  using (id = auth.uid());

create policy "profiles: owner and manager read all"
  on public.profiles for select to authenticated
  using (public.has_role('owner', 'manager'));

create policy "profiles: update own"
  on public.profiles for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- Only the display name is self-editable. role and is_active change only
-- through the owner-checked functions below.
grant select on table public.profiles to authenticated;
grant update (full_name) on table public.profiles to authenticated;

create function public.set_user_role(target uuid, new_role public.app_role)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.has_role('owner') then
    raise exception 'Only the owner can change roles' using errcode = '42501';
  end if;
  if target = auth.uid() then
    raise exception 'The owner cannot change their own role' using errcode = '42501';
  end if;

  update public.profiles set role = new_role where id = target;
  if not found then
    raise exception 'Profile not found' using errcode = 'P0002';
  end if;
end;
$$;

-- Deactivation takes effect at once: current_app_role() returns null for an
-- inactive profile, so every policy denies them, and deleting their sessions
-- stops their refresh tokens from minting new access tokens.
create function public.set_user_active(target uuid, active boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.has_role('owner') then
    raise exception 'Only the owner can deactivate accounts' using errcode = '42501';
  end if;
  if target = auth.uid() then
    raise exception 'The owner cannot deactivate their own account' using errcode = '42501';
  end if;

  update public.profiles set is_active = active where id = target;
  if not found then
    raise exception 'Profile not found' using errcode = 'P0002';
  end if;

  -- Ending sessions is a second layer. If Supabase ever narrows the
  -- privileges on its auth schema, the deactivation above must still stand.
  if not active then
    begin
      delete from auth.sessions where user_id = target;
    exception when insufficient_privilege then
      raise warning 'Could not end sessions for %; access is still blocked by RLS', target;
    end;
  end if;
end;
$$;

grant execute on function public.set_user_role(uuid, public.app_role) to authenticated;
grant execute on function public.set_user_active(uuid, boolean) to authenticated;

-- Makes the first owner. Runs only from the SQL editor or a service
-- connection, and only while no owner exists, so it cannot be used to seize
-- the gym after setup.
create function public.bootstrap_owner(owner_email text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from public.profiles where role = 'owner') then
    raise exception 'An owner already exists' using errcode = '42501';
  end if;

  update public.profiles set role = 'owner', is_active = true
  where lower(email) = lower(owner_email);
  if not found then
    raise exception 'No account with that email has signed in yet' using errcode = 'P0002';
  end if;
end;
$$;

-- Stated outright as well, because before setup this function hands over the
-- whole gym to whoever calls it.
revoke execute on function public.bootstrap_owner(text) from public, anon, authenticated;
