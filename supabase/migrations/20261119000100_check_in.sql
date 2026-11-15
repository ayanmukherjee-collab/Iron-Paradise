-- Phase 4: member check-in by desk QR (brief §4.3).
--
-- Two kinds of QR lead to the same check-in:
-- - Rotating: a desk display shows a code that changes every 30 seconds, so a
--   photo of it is useless from home. Always accepted.
-- - Printed: one fixed code on paper at the desk. A photo of it works from
--   anywhere, so the owner can switch it off once a desk device exists.
--   On by default: the gym has no desk device yet (owner, 2026-11-15).
--
-- Secrets live in the `private` schema, which Supabase's Data API does not
-- expose and no app role can read. Only security-definer functions below,
-- and the server itself, reach it.

create schema private;
revoke all on schema private from public, anon, authenticated;

-- The rotating-code secret and the printed code. One row.
create table private.checkin_codes (
  id boolean primary key default true check (id),
  rotating_secret text not null
    default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  printed_code text not null default replace(gen_random_uuid()::text, '-', ''),
  printed_code_changed_at timestamptz not null default now()
);
alter table private.checkin_codes enable row level security;
insert into private.checkin_codes (id) values (true);

alter table public.gym_settings
  add column printed_qr_enabled boolean not null default true;
grant update (printed_qr_enabled) on table public.gym_settings to authenticated;

-- Seconds each rotating code is shown for. A code stays valid for one more
-- step after it rotates, so a scan just before the change still works.
create function private.checkin_step()
returns bigint
language sql
stable
set search_path = ''
as $$
  select floor(extract(epoch from now()) / 30)::bigint;
$$;

create function private.rotating_code(step bigint)
returns text
language sql
stable
set search_path = ''
as $$
  select left(encode(sha256(convert_to(c.rotating_secret || ':' || step, 'UTF8')), 'hex'), 12)
  from private.checkin_codes c;
$$;

-- Desk displays: a device holding a secret link that shows the rotating QR
-- and nothing else, so no staff account stays signed in at the desk.
create table public.desk_displays (
  id uuid primary key default gen_random_uuid(),
  label text not null check (char_length(label) between 1 and 40),
  token_hash bytea not null unique,
  created_by uuid not null references public.profiles (id) default auth.uid(),
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  last_seen_at timestamptz
);
alter table public.desk_displays enable row level security;
revoke all on table public.desk_displays from anon, authenticated;

create policy "desk_displays: owner and manager read"
  on public.desk_displays for select to authenticated
  using ((select public.has_role('owner', 'manager')));

-- Never token_hash: nobody needs it back.
grant select (id, label, created_by, created_at, revoked_at, last_seen_at)
  on table public.desk_displays to authenticated;

-- Set-up and switch-off are logged; the once-a-minute "last seen" is not.
create trigger desk_displays_audit
  after insert or update of revoked_at on public.desk_displays
  for each row execute function public.write_audit();

create function public.create_desk_display(display_label text, raw_token text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_id uuid;
begin
  if not public.has_role('owner', 'manager') then
    raise exception 'Only the owner or a manager can set up a desk display' using errcode = '42501';
  end if;
  if length(raw_token) < 32 then
    raise exception 'Desk token is too short' using errcode = '22023';
  end if;
  insert into public.desk_displays (label, token_hash)
  values (btrim(display_label), sha256(convert_to(raw_token, 'UTF8')))
  returning id into new_id;
  return new_id;
end;
$$;

create function public.revoke_desk_display(display uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.has_role('owner', 'manager') then
    raise exception 'Only the owner or a manager can switch off a desk display' using errcode = '42501';
  end if;
  update public.desk_displays set revoked_at = now()
  where id = display and revoked_at is null;
end;
$$;

-- What a desk display shows. Called by the server for a signed-out device,
-- so it lives in `private` (never callable through the Data API) and checks
-- the desk token itself.
create function private.desk_checkin_code(raw_token text)
returns table (code text, seconds_left integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  display public.desk_displays%rowtype;
begin
  select * into display from public.desk_displays
  where token_hash = sha256(convert_to(raw_token, 'UTF8')) and revoked_at is null;
  if not found then
    raise exception 'This desk link is switched off. Ask the owner for a new one.' using errcode = 'P0001';
  end if;

  -- "Last seen" helps the owner spot a forgotten device. Once a minute is plenty.
  if display.last_seen_at is null or display.last_seen_at < now() - interval '1 minute' then
    update public.desk_displays set last_seen_at = now() where id = display.id;
  end if;

  return query select
    private.rotating_code(private.checkin_step()),
    (30 - floor(extract(epoch from now()))::bigint % 30)::integer;
end;
$$;

-- Lets the owner or a manager print the desk QR.
create function public.printed_checkin_code()
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.has_role('owner', 'manager') then
    raise exception 'Only the owner or a manager can see the printed check-in code' using errcode = '42501';
  end if;
  return (select printed_code from private.checkin_codes);
end;
$$;

-- A new printed code, for when a photo of the old one is going around.
create function public.regenerate_printed_checkin_code()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.has_role('owner') then
    raise exception 'Only the owner can replace the printed check-in code' using errcode = '42501';
  end if;
  update private.checkin_codes
  set printed_code = replace(gen_random_uuid()::text, '-', ''),
      printed_code_changed_at = now();
  -- Logged by hand: the generic audit trigger would copy the codes themselves.
  insert into public.audit_log (actor_id, table_name, record_id, action, before, after)
  values (auth.uid(), 'checkin_codes', 'printed', 'update', null,
          jsonb_build_object('printed_code', 'replaced'));
end;
$$;

-- A member checks themselves in with a code from a desk QR. Returns
-- 'checked_in', or 'already' when they were in earlier today.
create function public.check_in(code text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := public.own_member_id();
  member_active boolean;
  step bigint := private.checkin_step();
  accepted boolean;
  inserted uuid;
begin
  if me is null then
    raise exception 'This account isn''t linked to a gym membership yet.' using errcode = 'P0001';
  end if;

  select is_active into member_active from public.members where id = me;
  if not member_active then
    raise exception 'Your membership is marked inactive. Talk to the front desk.' using errcode = 'P0001';
  end if;

  accepted := code = private.rotating_code(step)
    or code = private.rotating_code(step - 1)
    or (
      (select printed_qr_enabled from public.gym_settings)
      and code = (select printed_code from private.checkin_codes)
    );
  if not accepted then
    raise exception 'That code has expired. Scan the QR at the desk again.' using errcode = 'P0001';
  end if;

  insert into public.attendance (member_id, method, marked_by)
  values (me, 'qr', auth.uid())
  on conflict (member_id, gym_date) do nothing
  returning id into inserted;

  return case when inserted is null then 'already' else 'checked_in' end;
end;
$$;

grant execute on function public.create_desk_display(text, text) to authenticated;
grant execute on function public.revoke_desk_display(uuid) to authenticated;
grant execute on function public.printed_checkin_code() to authenticated;
grant execute on function public.regenerate_printed_checkin_code() to authenticated;
grant execute on function public.check_in(text) to authenticated;
