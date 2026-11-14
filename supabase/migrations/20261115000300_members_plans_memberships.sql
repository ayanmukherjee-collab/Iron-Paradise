-- Members are created by staff and exist without an account. A member row is
-- linked to a profile only when the person claims it (see claim_tokens).
-- Members are never deleted: "remove" means is_active = false.

create sequence public.member_code_seq;

create table public.members (
  id uuid primary key default gen_random_uuid(),
  -- Short, human-friendly ID the gym writes on fee slips (IP-0042).
  member_code text not null unique
    default 'IP-' || lpad(nextval('public.member_code_seq')::text, 4, '0'),
  full_name text not null check (length(trim(full_name)) between 1 and 120),
  phone text not null check (phone ~ '^\+?[0-9]{10,15}$'),
  is_active boolean not null default true,
  profile_id uuid unique references public.profiles (id) on delete set null,
  reminder_consent_at timestamptz,
  reminders_muted boolean not null default false,
  created_by uuid references public.profiles (id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.members enable row level security;
revoke all on table public.members from anon, authenticated;

create trigger members_touch_updated_at
  before update on public.members
  for each row execute function public.touch_updated_at();

create trigger members_audit
  after insert or update on public.members
  for each row execute function public.write_audit();

create trigger members_never_deleted
  before delete on public.members
  for each row execute function public.reject_change();

-- Lets member-scoped policies on other tables ask "is this row mine?"
-- without granting members read access to every member row.
create function public.is_own_member(target_member uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.members
    where id = target_member and profile_id = auth.uid()
  ) and public.current_app_role() is not null;
$$;
grant execute on function public.is_own_member(uuid) to authenticated;

create policy "members: staff read"
  on public.members for select to authenticated
  using (public.is_staff());

create policy "members: read own"
  on public.members for select to authenticated
  using (profile_id = auth.uid() and public.current_app_role() is not null);

create policy "members: owner and manager add"
  on public.members for insert to authenticated
  with check (public.has_role('owner', 'manager') and created_by = auth.uid());

create policy "members: owner and manager edit"
  on public.members for update to authenticated
  using (public.has_role('owner', 'manager'))
  with check (public.has_role('owner', 'manager'));

grant select on table public.members to authenticated;
grant insert on table public.members to authenticated;
grant update (full_name, phone, is_active, reminders_muted) on table public.members to authenticated;
grant usage on sequence public.member_code_seq to authenticated;

create table public.plans (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (length(trim(name)) between 1 and 60),
  duration_months smallint not null check (duration_months between 1 and 24),
  price_paise integer not null check (price_paise >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.plans enable row level security;
revoke all on table public.plans from anon, authenticated;

create trigger plans_touch_updated_at
  before update on public.plans
  for each row execute function public.touch_updated_at();

create policy "plans: signed-in members and staff read"
  on public.plans for select to authenticated
  using (public.has_role('owner', 'manager', 'trainer', 'member'));

create policy "plans: owner adds"
  on public.plans for insert to authenticated
  with check (public.has_role('owner'));

create policy "plans: owner edits"
  on public.plans for update to authenticated
  using (public.has_role('owner'))
  with check (public.has_role('owner'));

grant select on table public.plans to authenticated;
grant insert on table public.plans to authenticated;
grant update (name, duration_months, price_paise, is_active) on table public.plans to authenticated;

-- Expiry is derived from the plan, the start date and payments, never typed
-- in. Phase 2 adds the computation; this table holds only the inputs.
create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members (id),
  plan_id uuid not null references public.plans (id),
  starts_on date not null,
  frozen_from date,
  frozen_until date,
  created_by uuid references public.profiles (id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (frozen_until is null or frozen_from is not null),
  check (frozen_until is null or frozen_until >= frozen_from)
);
alter table public.memberships enable row level security;
revoke all on table public.memberships from anon, authenticated;

create index memberships_member_id_idx on public.memberships (member_id);

create trigger memberships_touch_updated_at
  before update on public.memberships
  for each row execute function public.touch_updated_at();

create trigger memberships_audit
  after insert or update on public.memberships
  for each row execute function public.write_audit();

create trigger memberships_never_deleted
  before delete on public.memberships
  for each row execute function public.reject_change();

create policy "memberships: staff read"
  on public.memberships for select to authenticated
  using (public.is_staff());

create policy "memberships: read own"
  on public.memberships for select to authenticated
  using (public.is_own_member(member_id));

create policy "memberships: owner and manager add"
  on public.memberships for insert to authenticated
  with check (public.has_role('owner', 'manager') and created_by = auth.uid());

create policy "memberships: owner and manager edit"
  on public.memberships for update to authenticated
  using (public.has_role('owner', 'manager'))
  with check (public.has_role('owner', 'manager'));

grant select on table public.memberships to authenticated;
grant insert on table public.memberships to authenticated;
grant update (plan_id, starts_on, frozen_from, frozen_until) on table public.memberships to authenticated;
