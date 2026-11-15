-- One check-in per member per gym day. Member self check-in through the
-- rotating desk QR arrives in Phase 4 as a checked function; for now only
-- staff can write attendance.

create type public.attendance_method as enum ('qr', 'manual');

create table public.attendance (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members (id),
  checked_in_at timestamptz not null default now(),
  -- The gym's local calendar day, so a 00:30 IST visit counts for that day
  -- rather than the previous UTC date.
  gym_date date not null default (now() at time zone 'Asia/Kolkata')::date,
  method public.attendance_method not null,
  marked_by uuid references public.profiles (id) default auth.uid(),
  unique (member_id, gym_date)
);
alter table public.attendance enable row level security;
revoke all on table public.attendance from anon, authenticated;

create index attendance_gym_date_idx on public.attendance (gym_date);

create policy "attendance: staff read"
  on public.attendance for select to authenticated
  using (public.is_staff());

create policy "attendance: read own"
  on public.attendance for select to authenticated
  using (public.is_own_member(member_id));

create policy "attendance: staff mark"
  on public.attendance for insert to authenticated
  with check (public.is_staff() and marked_by = auth.uid() and method = 'manual');

grant select on table public.attendance to authenticated;
grant insert on table public.attendance to authenticated;
