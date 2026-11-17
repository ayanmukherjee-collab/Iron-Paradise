-- Member bulletin, steps 2 and 3: closures, announcements, and check-ins
-- that follow the opening hours (owner, 2026-11-17).
--
-- Opening hours (gym_settings.weekly_hours) replace the two fixed training
-- batches. An opening that starts before noon is the morning batch, one
-- that starts at noon or later is the evening batch, so attendance keeps
-- its morning/evening split. A check-in is refused unless it falls inside
-- an opening for that day, after closures are applied.

-- One day's openings: the same rules as each day of weekly_hours.
create function public.is_day_hours(value jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select public.is_weekly_hours(jsonb_build_object(
    'sun', value, 'mon', '[]'::jsonb, 'tue', '[]'::jsonb, 'wed', '[]'::jsonb,
    'thu', '[]'::jsonb, 'fri', '[]'::jsonb, 'sat', '[]'::jsonb
  ));
$$;
-- Runs inside a check constraint, as whoever saves (see is_weekly_hours).
grant execute on function public.is_day_hours(jsonb) to authenticated;

-- A day the gym is shut or keeps shorter hours. hours null: closed all day;
-- an array: the openings that still run that day. The owner or a manager can
-- close a batch or the whole day from Home. Past rows stay as history; the
-- bulletin carries only today onwards.
create table public.gym_closures (
  id uuid primary key default gen_random_uuid(),
  closes_on date not null unique,
  reason text not null default '' check (length(reason) <= 80),
  hours jsonb check (hours is null or public.is_day_hours(hours)),
  created_by uuid not null references public.profiles (id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.gym_closures enable row level security;
revoke all on table public.gym_closures from anon, authenticated;

create trigger gym_closures_touch_updated_at
  before update on public.gym_closures
  for each row execute function public.touch_updated_at();

create trigger gym_closures_audit
  after insert or update or delete on public.gym_closures
  for each row execute function public.write_audit();

create policy "gym_closures: staff read"
  on public.gym_closures for select to authenticated
  using ((select public.is_staff()));

create policy "gym_closures: owner and manager add"
  on public.gym_closures for insert to authenticated
  with check (
    (select public.has_role('owner', 'manager'))
    and created_by = (select auth.uid())
  );

create policy "gym_closures: owner and manager change"
  on public.gym_closures for update to authenticated
  using ((select public.has_role('owner', 'manager')))
  with check ((select public.has_role('owner', 'manager')));

create policy "gym_closures: owner and manager reopen"
  on public.gym_closures for delete to authenticated
  using ((select public.has_role('owner', 'manager')));

grant select, insert, delete on table public.gym_closures to authenticated;
grant update (reason, hours) on table public.gym_closures to authenticated;

-- Notices for members. They reach phones only through bulletin.json, which
-- anyone with its link can read, so nothing private belongs here. Members
-- don't read this table.
create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(btrim(title)) between 1 and 120),
  body text not null default '' check (length(body) <= 2000),
  pinned boolean not null default false,
  expires_at timestamptz,
  created_by uuid not null references public.profiles (id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.announcements enable row level security;
revoke all on table public.announcements from anon, authenticated;

create index announcements_live_idx
  on public.announcements (pinned desc, created_at desc);

create trigger announcements_stamp_created_at
  before insert on public.announcements
  for each row execute function public.stamp_server_time('created_at');

create trigger announcements_touch_updated_at
  before update on public.announcements
  for each row execute function public.touch_updated_at();

create trigger announcements_audit
  after insert or update or delete on public.announcements
  for each row execute function public.write_audit();

create policy "announcements: owner and manager read"
  on public.announcements for select to authenticated
  using ((select public.has_role('owner', 'manager')));

create policy "announcements: owner and manager post"
  on public.announcements for insert to authenticated
  with check (
    (select public.has_role('owner', 'manager'))
    and created_by = (select auth.uid())
  );

create policy "announcements: owner and manager edit"
  on public.announcements for update to authenticated
  using ((select public.has_role('owner', 'manager')))
  with check ((select public.has_role('owner', 'manager')));

create policy "announcements: owner and manager remove"
  on public.announcements for delete to authenticated
  using ((select public.has_role('owner', 'manager')));

-- Whole-row insert (the ORM names every column); created_at is stamped.
grant select, insert, delete on table public.announcements to authenticated;
grant update (title, body, pinned, expires_at) on table public.announcements to authenticated;

-- The openings that run on a gym date: that day's closure if there is one,
-- else the weekly hours for its weekday. Hours are public (they go out in
-- bulletin.json), so any signed-in user may ask.
create function public.gym_hours_on(day date)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select coalesce(c.hours, '[]'::jsonb) from public.gym_closures c where c.closes_on = day),
    (select s.weekly_hours -> (array['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'])[extract(dow from day)::int + 1]
     from public.gym_settings s),
    '[]'::jsonb
  );
$$;
grant execute on function public.gym_hours_on(date) to authenticated;

-- Which batch a moment falls in, in gym time: 'morning' (an opening that
-- starts before noon), 'evening', or null when the gym is shut. Openings are
-- open-inclusive and close-exclusive. One whose close is earlier than its
-- open runs past midnight, so the night before's late opening counts too.
create or replace function public.batch_at(moment timestamptz)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  with gym as (
    select (moment at time zone 'Asia/Kolkata')::date as day,
           (moment at time zone 'Asia/Kolkata')::time as t
  ),
  openings as (
    select (o ->> 'open')::time as opens, (o ->> 'close')::time as closes, false as from_yesterday
    from gym, jsonb_array_elements(public.gym_hours_on(gym.day)) o
    union all
    select (o ->> 'open')::time, (o ->> 'close')::time, true
    from gym, jsonb_array_elements(public.gym_hours_on(gym.day - 1)) o
  )
  select case when opens < '12:00' then 'morning' else 'evening' end
  from openings, gym
  where case
    when from_yesterday then closes < opens and gym.t < closes
    when closes > opens then gym.t >= opens and gym.t < closes
    else gym.t >= opens
  end
  order by from_yesterday
  limit 1;
$$;

-- Same trigger as before, with the reasons it now has.
create or replace function public.attendance_within_batch()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  today jsonb := public.gym_hours_on((new.checked_in_at at time zone 'Asia/Kolkata')::date);
begin
  if public.batch_at(new.checked_in_at) is not null then
    return new;
  end if;
  if jsonb_array_length(today) = 0 then
    raise exception 'The gym is closed today.' using errcode = 'P0001';
  end if;
  raise exception 'Check-in is open % today.',
    (select string_agg((o ->> 'open') || '–' || (o ->> 'close'), ' and ' order by o ->> 'open')
     from jsonb_array_elements(today) o)
    using errcode = 'P0001';
end;
$$;

-- The fixed batch times are replaced by weekly_hours.
alter table public.gym_settings
  drop constraint gym_settings_batches_in_order,
  drop column morning_opens,
  drop column morning_closes,
  drop column evening_opens,
  drop column evening_closes;

-- The bulletin now carries closures from today on and the newest 20 live
-- announcements, pinned first.
create or replace function public.publish_bulletin()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  s public.gym_settings%rowtype;
  today date := (now() at time zone 'Asia/Kolkata')::date;
  iso constant text := 'YYYY-MM-DD"T"HH24:MI:SS"Z"';
begin
  if not public.has_role('owner', 'manager') then
    raise exception 'Only the owner or a manager can publish the bulletin' using errcode = '42501';
  end if;

  select * into s from public.gym_settings;

  return jsonb_build_object(
    'version', nextval('public.bulletin_version_seq'),
    'updatedAt', to_char(now() at time zone 'UTC', iso),
    'timezone', 'Asia/Kolkata',
    'hours', s.weekly_hours,
    'closures', coalesce((
      select jsonb_agg(jsonb_build_object(
        'date', to_char(c.closes_on, 'YYYY-MM-DD'),
        'reason', c.reason,
        'hours', c.hours
      ) order by c.closes_on)
      from (
        select * from public.gym_closures
        where closes_on >= today
        order by closes_on
        limit 60
      ) c
    ), '[]'::jsonb),
    'announcements', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', a.id,
        'title', a.title,
        'body', a.body,
        'pinned', a.pinned,
        'expiresAt', to_char(a.expires_at at time zone 'UTC', iso),
        'createdAt', to_char(a.created_at at time zone 'UTC', iso)
      ) order by a.pinned desc, a.created_at desc)
      from (
        select * from public.announcements
        where expires_at is null or expires_at > now()
        order by pinned desc, created_at desc
        limit 20
      ) a
    ), '[]'::jsonb),
    'crowd', jsonb_build_object(
      'comfortableCapacity', s.crowd_capacity,
      'calibrationMultiplier', s.crowd_multiplier,
      'fullMinutes', s.crowd_full_minutes,
      'goneMinutes', s.crowd_gone_minutes
    )
  )::text;
end;
$$;
