-- The member bulletin: opening hours and crowd-meter settings, published as
-- bulletin.json for every member's phone to read without running the app's
-- Worker (see src/bulletin and workers/data).
--
-- Postgres builds the file itself (publish_bulletin), inside the same
-- transaction as the save that changed it, so the file always matches what
-- was saved and the Worker only passes the text on to storage. Closures and
-- announcements join the file in later migrations, which replace
-- publish_bulletin.

-- Opening hours per weekday, in gym time. Each day holds up to four
-- openings; an empty day is closed. A close earlier than the open runs past
-- midnight (18:00–02:00). Checked here as well as in the app, because a bad
-- value would break every member's phone at once.
create function public.is_weekly_hours(value jsonb)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  day_key text;
  day_hours jsonb;
  opening jsonb;
  clock constant text := '^([01][0-9]|2[0-3]):[0-5][0-9]$';
begin
  if value is null or jsonb_typeof(value) <> 'object' then
    return false;
  end if;
  if (select count(*) from jsonb_object_keys(value)) <> 7 then
    return false;
  end if;
  for day_key, day_hours in select * from jsonb_each(value) loop
    if day_key not in ('sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat')
       or jsonb_typeof(day_hours) <> 'array'
       or jsonb_array_length(day_hours) > 4 then
      return false;
    end if;
    for opening in select * from jsonb_array_elements(day_hours) loop
      if jsonb_typeof(opening) <> 'object'
         or (select count(*) from jsonb_object_keys(opening)) <> 2
         or jsonb_typeof(opening -> 'open') <> 'string'
         or jsonb_typeof(opening -> 'close') <> 'string'
         or (opening ->> 'open') !~ clock
         or (opening ->> 'close') !~ clock
         or (opening ->> 'open') = (opening ->> 'close') then
        return false;
      end if;
    end loop;
  end loop;
  return true;
end;
$$;
-- The check constraint below runs as whoever saves settings, so they need
-- to be able to call it. It only inspects the value it is given.
grant execute on function public.is_weekly_hours(jsonb) to authenticated;

-- Defaults are the hours on the public site today (owner, 2026-11-16 and
-- 2026-11-17): 5–10 AM and 4–10 PM, Monday to Saturday, closed Sunday.
alter table public.gym_settings
  add column weekly_hours jsonb not null default '{
    "sun": [],
    "mon": [{"open": "05:00", "close": "10:00"}, {"open": "16:00", "close": "22:00"}],
    "tue": [{"open": "05:00", "close": "10:00"}, {"open": "16:00", "close": "22:00"}],
    "wed": [{"open": "05:00", "close": "10:00"}, {"open": "16:00", "close": "22:00"}],
    "thu": [{"open": "05:00", "close": "10:00"}, {"open": "16:00", "close": "22:00"}],
    "fri": [{"open": "05:00", "close": "10:00"}, {"open": "16:00", "close": "22:00"}],
    "sat": [{"open": "05:00", "close": "10:00"}, {"open": "16:00", "close": "22:00"}]
  }'::jsonb
    constraint gym_settings_weekly_hours_valid check (public.is_weekly_hours(weekly_hours)),
  -- Crowd meter. The phone estimates who is inside from recent check-ins:
  -- each counts fully for crowd_full_minutes, then fades to nothing by
  -- crowd_gone_minutes. The multiplier makes up for members who don't scan.
  add column crowd_capacity smallint not null default 40
    check (crowd_capacity between 1 and 1000),
  add column crowd_multiplier numeric(3, 2) not null default 1.00
    check (crowd_multiplier between 0.50 and 5.00),
  add column crowd_full_minutes smallint not null default 45,
  add column crowd_gone_minutes smallint not null default 120,
  add constraint gym_settings_crowd_minutes_in_order check (
    crowd_full_minutes between 5 and 235
    and crowd_gone_minutes between crowd_full_minutes + 5 and 240
  );

grant update (weekly_hours, crowd_capacity, crowd_multiplier, crowd_full_minutes, crowd_gone_minutes)
  on table public.gym_settings to authenticated;

-- Each published bulletin gets the next number, so a phone can tell a newer
-- file from an older one. A sequence rather than a settings column: bumping
-- a column would add an audit-log row on every publish, and a number
-- skipped by a rolled-back save does no harm.
create sequence public.bulletin_version_seq;
revoke all on sequence public.bulletin_version_seq from public, anon, authenticated;

-- The whole bulletin.json, as text. Owner and managers only: they are the
-- ones whose saves change it (announcements are managers' too).
create function public.publish_bulletin()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  s public.gym_settings%rowtype;
begin
  if not public.has_role('owner', 'manager') then
    raise exception 'Only the owner or a manager can publish the bulletin' using errcode = '42501';
  end if;

  select * into s from public.gym_settings;

  return jsonb_build_object(
    'version', nextval('public.bulletin_version_seq'),
    'updatedAt', to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
    'timezone', 'Asia/Kolkata',
    'hours', s.weekly_hours,
    'closures', '[]'::jsonb,
    'announcements', '[]'::jsonb,
    'crowd', jsonb_build_object(
      'comfortableCapacity', s.crowd_capacity,
      'calibrationMultiplier', s.crowd_multiplier,
      'fullMinutes', s.crowd_full_minutes,
      'goneMinutes', s.crowd_gone_minutes
    )
  )::text;
end;
$$;

grant execute on function public.publish_bulletin() to authenticated;
