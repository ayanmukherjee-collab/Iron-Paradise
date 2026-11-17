-- The crowd meter for the static app. The old app had Postgres build
-- crowd.json during each check-in and published it to Cloudflare KV. The
-- static app has no Worker, so phones ask the database directly with
-- public.crowd(): check-in times of the last two hours, to the minute,
-- newest first. No names or member ids. Phones turn the times into
-- Quiet / Moderate / Busy themselves (src/bulletin/crowd.ts).
--
-- The once-a-minute throttle only existed to stay under KV's write limit,
-- so it goes, along with the function that used it.

drop function public.crowd_after_check_in();
drop table private.crowd_publish;

-- attendance_checked_in_at_idx (from 20261124000100) keeps this cheap.
create function public.crowd()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  iso constant text := 'YYYY-MM-DD"T"HH24:MI:SS"Z"';
begin
  if auth.uid() is null then
    raise exception 'Sign in to see how busy the gym is' using errcode = '42501';
  end if;

  return jsonb_build_object(
    'generatedAt', to_char(date_trunc('minute', now()) at time zone 'UTC', iso),
    'checkins', coalesce(
      (select jsonb_agg(
                to_char(date_trunc('minute', a.checked_in_at) at time zone 'UTC', iso)
                order by a.checked_in_at desc)
       from (
         select checked_in_at from public.attendance
         where checked_in_at > now() - interval '120 minutes'
           and checked_in_at <= now()
         order by checked_in_at desc
         limit 2000
       ) a),
      '[]'::jsonb
    )
  );
end;
$$;

revoke all on function public.crowd() from public, anon;
grant execute on function public.crowd() to authenticated;
