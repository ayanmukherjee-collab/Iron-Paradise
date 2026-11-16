-- Training batches: check-ins count only in the morning and evening batches
-- (owner, 2026-11-16). A check-in at any other hour is refused, however it
-- arrives: the member's QR scan or a staff member marking them in.
--
-- Still one visit per member per day: someone who comes to both batches is
-- counted once, in the batch they arrived for first.

alter table public.gym_settings
  add column morning_opens time not null default '05:00',
  add column morning_closes time not null default '11:00',
  add column evening_opens time not null default '16:00',
  add column evening_closes time not null default '22:00',
  add constraint gym_settings_batches_in_order check (
    morning_opens < morning_closes
    and morning_closes <= evening_opens
    and evening_opens < evening_closes
  );

grant update (morning_opens, morning_closes, evening_opens, evening_closes)
  on table public.gym_settings to authenticated;

-- Which batch a moment falls in, in gym time: 'morning', 'evening', or null
-- outside both. Opening times are inclusive, closing times exclusive.
create function public.batch_at(moment timestamptz)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when local.t >= s.morning_opens and local.t < s.morning_closes then 'morning'
    when local.t >= s.evening_opens and local.t < s.evening_closes then 'evening'
  end
  from public.gym_settings s
  cross join lateral (
    select (moment at time zone 'Asia/Kolkata')::time as t
  ) local;
$$;

create function public.attendance_within_batch()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  s public.gym_settings%rowtype;
begin
  if public.batch_at(new.checked_in_at) is not null then
    return new;
  end if;
  select * into s from public.gym_settings;
  raise exception 'Check-in is open %–% and %–% only.',
    to_char(s.morning_opens, 'HH24:MI'), to_char(s.morning_closes, 'HH24:MI'),
    to_char(s.evening_opens, 'HH24:MI'), to_char(s.evening_closes, 'HH24:MI')
    using errcode = 'P0001';
end;
$$;

create trigger attendance_within_batch
  before insert on public.attendance
  for each row execute function public.attendance_within_batch();
