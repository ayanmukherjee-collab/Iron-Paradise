-- The crowd meter: crowd.json, the check-in times of the last two hours,
-- published to members' phones (see src/bulletin/crowd.ts and workers/data).
-- Phones turn the times into Quiet / Moderate / Busy themselves, so the file
-- only changes when someone checks in.
--
-- Built here, in the check-in's own transaction, so the app spends one
-- statement and almost no CPU on it. It is rebuilt at most once a minute:
-- the free plan allows 1,000 storage writes a day.

-- When crowd.json was last built. One row, in the private schema so no app
-- role can read or touch it, and not in gym_settings, whose every update
-- writes an audit row and takes the settings row lock.
create table private.crowd_publish (
  id boolean primary key default true check (id),
  built_at timestamptz not null default '-infinity'
);
alter table private.crowd_publish enable row level security;
insert into private.crowd_publish (id) values (true);

-- The last two hours of check-ins, read on every rebuild.
create index attendance_checked_in_at_idx on public.attendance (checked_in_at);

-- crowd.json as text, or null when there's nothing new to publish:
-- - null unless this transaction has just saved a check-in (its time is the
--   transaction's start, now()), so calling it on its own does nothing;
-- - null if crowd.json was built less than a minute ago. The claim is a row
--   update: a second check-in in the same moment waits for the first to
--   commit and then finds the minute taken. A rolled-back check-in releases
--   its claim.
-- Times only, to the minute, newest first: no names or member ids.
create function public.crowd_after_check_in()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  claimed boolean;
begin
  if not exists (
    select 1 from public.attendance
    where checked_in_at = now()
      and (public.is_staff() or member_id = public.own_member_id())
  ) then
    return null;
  end if;

  update private.crowd_publish
  set built_at = now()
  where built_at <= now() - interval '1 minute'
  returning true into claimed;
  if claimed is null then
    return null;
  end if;

  return jsonb_build_object(
    'generatedAt', to_char(date_trunc('minute', now()) at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
    'checkins', coalesce(
      (select jsonb_agg(
                to_char(date_trunc('minute', checked_in_at) at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
                order by checked_in_at desc)
       from public.attendance
       where checked_in_at > now() - interval '120 minutes'
         and checked_in_at <= now()),
      '[]'::jsonb
    )
  )::text;
end;
$$;

revoke all on function public.crowd_after_check_in() from public, anon;
grant execute on function public.crowd_after_check_in() to authenticated;
