-- Phase 2: negotiated fees, freezes, ended memberships, guest linking and
-- gym settings. Rules come from section 4.2 of the brief:
--   * every membership has its own agreed monthly fee (0 = free member);
--     plans only supply a default;
--   * fees fall due on each joining-date anniversary;
--   * freezes pause fees and push due dates back;
--   * a member who comes back after leaving starts a new membership, so the
--     months they were away are never billed.

-- Plans are defaults only.
alter table public.plans rename column price_paise to default_fee_paise;

-- A membership no longer needs a plan, gains an end date, and moves its
-- freezes into their own table so several can be kept over time.
alter table public.memberships alter column plan_id drop not null;
alter table public.memberships drop column frozen_from, drop column frozen_until;
alter table public.memberships add column ended_on date;
alter table public.memberships add constraint memberships_ends_after_start
  check (ended_on is null or ended_on >= starts_on);

create unique index memberships_one_open_per_member
  on public.memberships (member_id)
  where ended_on is null;

grant update (ended_on) on table public.memberships to authenticated;

-- A member is linked to an account only through link_guest_to_member or a
-- claim link, both of which also make the account a member. Writing
-- profile_id directly would skip that.
drop policy "members: owner and manager add" on public.members;
create policy "members: owner and manager add"
  on public.members for insert to authenticated
  with check (
    public.has_role('owner', 'manager')
    and created_by = auth.uid()
    and profile_id is null
  );

-- Agreed fees. Rows are never changed: a new fee, or a correction, is a new
-- row. The fee for a date is the newest row whose effective_from is on or
-- before that date, so past months keep the fee that applied then.
create table public.membership_fees (
  id uuid primary key default gen_random_uuid(),
  membership_id uuid not null references public.memberships (id),
  fee_paise integer not null check (fee_paise >= 0),
  effective_from date not null,
  note text check (length(note) <= 200),
  set_by uuid not null references public.profiles (id) default auth.uid(),
  created_at timestamptz not null default now()
);
alter table public.membership_fees enable row level security;
revoke all on table public.membership_fees from anon, authenticated;

create index membership_fees_membership_idx
  on public.membership_fees (membership_id, effective_from desc, created_at desc);

create trigger membership_fees_stamp_created_at
  before insert on public.membership_fees
  for each row execute function public.stamp_server_time('created_at');

create trigger membership_fees_audit
  after insert on public.membership_fees
  for each row execute function public.write_audit();

create trigger membership_fees_immutable
  before update or delete on public.membership_fees
  for each row execute function public.reject_change();

create function public.is_own_membership(target_membership uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.memberships ms
    where ms.id = target_membership and public.is_own_member(ms.member_id)
  );
$$;
grant execute on function public.is_own_membership(uuid) to authenticated;

-- Fees are payment information: trainers see paid/due status (Phase 3), not
-- what each person agreed to pay.
create policy "membership_fees: owner and manager read"
  on public.membership_fees for select to authenticated
  using (public.has_role('owner', 'manager'));

create policy "membership_fees: read own"
  on public.membership_fees for select to authenticated
  using (public.is_own_membership(membership_id));

create policy "membership_fees: owner and manager set"
  on public.membership_fees for insert to authenticated
  with check (public.has_role('owner', 'manager') and set_by = auth.uid());

grant select, insert on table public.membership_fees to authenticated;

-- Freezes. ends_on is the last frozen day; null means frozen until further
-- notice. Ending a freeze is the only edit allowed.
create table public.membership_freezes (
  id uuid primary key default gen_random_uuid(),
  membership_id uuid not null references public.memberships (id),
  starts_on date not null,
  ends_on date,
  note text check (length(note) <= 200),
  created_by uuid not null references public.profiles (id) default auth.uid(),
  created_at timestamptz not null default now(),
  check (ends_on is null or ends_on >= starts_on)
);
alter table public.membership_freezes enable row level security;
revoke all on table public.membership_freezes from anon, authenticated;

create index membership_freezes_membership_idx
  on public.membership_freezes (membership_id, starts_on);

create function public.reject_overlapping_freeze()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.membership_freezes f
    where f.membership_id = new.membership_id
      and f.id <> new.id
      and f.starts_on <= coalesce(new.ends_on, 'infinity'::date)
      and coalesce(f.ends_on, 'infinity'::date) >= new.starts_on
  ) then
    raise exception 'This freeze overlaps another freeze on the same membership' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger membership_freezes_no_overlap
  before insert or update on public.membership_freezes
  for each row execute function public.reject_overlapping_freeze();

create trigger membership_freezes_audit
  after insert or update on public.membership_freezes
  for each row execute function public.write_audit();

create trigger membership_freezes_never_deleted
  before delete on public.membership_freezes
  for each row execute function public.reject_change();

create policy "membership_freezes: staff read"
  on public.membership_freezes for select to authenticated
  using (public.is_staff());

create policy "membership_freezes: read own"
  on public.membership_freezes for select to authenticated
  using (public.is_own_membership(membership_id));

create policy "membership_freezes: owner and manager add"
  on public.membership_freezes for insert to authenticated
  with check (public.has_role('owner', 'manager') and created_by = auth.uid());

create policy "membership_freezes: owner and manager end"
  on public.membership_freezes for update to authenticated
  using (public.has_role('owner', 'manager'))
  with check (public.has_role('owner', 'manager'));

grant select, insert on table public.membership_freezes to authenticated;
grant update (ends_on) on table public.membership_freezes to authenticated;

-- One row of gym-wide settings the owner can change.
create table public.gym_settings (
  id boolean primary key default true check (id),
  -- Days without a visit or payment before a member shows as "gone quiet".
  gone_quiet_days smallint not null default 30 check (gone_quiet_days between 7 and 180),
  updated_at timestamptz not null default now()
);
alter table public.gym_settings enable row level security;
revoke all on table public.gym_settings from anon, authenticated;

insert into public.gym_settings (id) values (true);

create trigger gym_settings_touch_updated_at
  before update on public.gym_settings
  for each row execute function public.touch_updated_at();

create trigger gym_settings_audit
  after update on public.gym_settings
  for each row execute function public.write_audit();

create policy "gym_settings: staff read"
  on public.gym_settings for select to authenticated
  using (public.is_staff());

create policy "gym_settings: owner edits"
  on public.gym_settings for update to authenticated
  using (public.has_role('owner'))
  with check (public.has_role('owner'));

grant select on table public.gym_settings to authenticated;
grant update (gone_quiet_days) on table public.gym_settings to authenticated;

-- Links a signed-up guest to a staff-created member record, the front-desk
-- alternative to a claim link. Makes the account a member and retires any
-- claim link still open for that record.
create function public.link_guest_to_member(target_profile uuid, target_member uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.has_role('owner', 'manager') then
    raise exception 'Only the owner or a manager can link accounts' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.profiles where id = target_profile and role = 'guest' and is_active
  ) then
    raise exception 'That account is not a waiting guest' using errcode = 'P0001';
  end if;

  if exists (select 1 from public.members where profile_id = target_profile) then
    raise exception 'That account is already linked to a member' using errcode = 'P0001';
  end if;

  update public.members set profile_id = target_profile
  where id = target_member and is_active and profile_id is null;
  if not found then
    raise exception 'That member is inactive or already has an account' using errcode = 'P0001';
  end if;

  update public.profiles set role = 'member' where id = target_profile;

  update public.claim_tokens set revoked_at = now()
  where member_id = target_member and used_at is null and revoked_at is null;
end;
$$;

grant execute on function public.link_guest_to_member(uuid, uuid) to authenticated;
