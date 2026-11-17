-- The static app (docs/static-rebuild.md): phones talk to the database
-- directly instead of through the Worker.
--
-- 1. Saves that took several statements in one server transaction become one
--    function each, so they stay all-or-nothing. They are SECURITY INVOKER:
--    every statement inside runs as the caller, under the same RLS policies
--    and column grants as before. Nothing here widens what anyone may do.
-- 2. Reads that summed or grouped rows in the database (the Data API can't)
--    become small functions, also SECURITY INVOKER, so RLS still decides
--    which rows count.
-- 3. bulletin(): the member bulletin, read straight from here instead of a
--    file the Worker published to Cloudflare KV.
-- 4. desk_code(): the rotating desk QR for a signed-out desk device, which
--    the Worker used to fetch on its privileged connection.

-- ---- 1. Multi-step saves --------------------------------------------------

-- A new membership and its first agreed fee. Callable on its own too: it is
-- exactly the two inserts staff could already make one by one.
create function public.start_membership(
  target_member uuid,
  starts date,
  plan uuid,
  fee_paise integer
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  membership uuid;
begin
  insert into public.memberships (member_id, plan_id, starts_on)
  values (target_member, plan, starts)
  returning id into membership;
  insert into public.membership_fees (membership_id, fee_paise, effective_from, set_by)
  values (membership, start_membership.fee_paise, starts, auth.uid());
  return membership;
end;
$$;
grant execute on function public.start_membership(uuid, date, uuid, integer) to authenticated;

create function public.add_member(
  full_name text,
  phone text,
  starts_on date,
  plan_id uuid,
  fee_paise integer,
  reminder_consent boolean
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  member uuid;
begin
  insert into public.members (full_name, phone, reminder_consent_at)
  values (
    add_member.full_name,
    add_member.phone,
    case when reminder_consent then now() end
  )
  returning id into member;
  perform public.start_membership(member, add_member.starts_on, add_member.plan_id, add_member.fee_paise);
  return member;
end;
$$;
grant execute on function public.add_member(text, text, date, uuid, integer, boolean) to authenticated;

-- "Remove" never deletes: inactive, and the open membership ends today.
create function public.deactivate_member(target_member uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  update public.members set is_active = false where id = target_member;
  if not found then
    raise exception 'That member no longer exists.' using errcode = 'P0002';
  end if;
  update public.memberships
  set ended_on = (now() at time zone 'Asia/Kolkata')::date
  where member_id = target_member and ended_on is null;
end;
$$;
grant execute on function public.deactivate_member(uuid) to authenticated;

create function public.reactivate_member(
  target_member uuid,
  starts_on date,
  plan_id uuid,
  fee_paise integer
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  update public.members set is_active = true where id = target_member;
  if not found then
    raise exception 'That member no longer exists.' using errcode = 'P0002';
  end if;
  perform public.start_membership(target_member, reactivate_member.starts_on, reactivate_member.plan_id, reactivate_member.fee_paise);
end;
$$;
grant execute on function public.reactivate_member(uuid, date, uuid, integer) to authenticated;

-- A guest who isn't on the books yet: their member record, membership and
-- the account link, together.
create function public.convert_guest(
  target_profile uuid,
  full_name text,
  phone text,
  starts_on date,
  plan_id uuid,
  fee_paise integer,
  reminder_consent boolean
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  member uuid;
begin
  if not exists (select 1 from public.profiles where id = target_profile) then
    raise exception 'That guest account no longer exists.' using errcode = 'P0002';
  end if;
  member := public.add_member(
    convert_guest.full_name,
    convert_guest.phone,
    convert_guest.starts_on,
    convert_guest.plan_id,
    convert_guest.fee_paise,
    convert_guest.reminder_consent
  );
  perform public.link_guest_to_member(target_profile, member);
  return member;
end;
$$;
grant execute on function public.convert_guest(uuid, text, text, date, uuid, integer, boolean) to authenticated;

-- A payment, and on a first payment the due dates staff picked ("Due from").
-- The phone works out new_due_changes with the same rules the server used
-- (src/members/billing.ts rescheduled); valid_due_changes checks the shape.
create function public.record_payment(
  member_id uuid,
  membership_id uuid,
  first_period smallint,
  amount_paise integer,
  method public.payment_method,
  paid_on date,
  receipt_number text,
  note text,
  new_due_changes jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  payment uuid;
begin
  if new_due_changes is not null then
    if exists (
      select 1 from public.payments p
      where p.membership_id = record_payment.membership_id
        and not exists (select 1 from public.payment_voids v where v.payment_id = p.id)
    ) then
      raise exception 'Due from is only for the first payment.' using errcode = 'P0001';
    end if;
    update public.memberships set due_changes = new_due_changes
    where id = record_payment.membership_id;
  end if;
  insert into public.payments (
    member_id, membership_id, first_period, amount_paise, method,
    paid_on, receipt_number, note
  )
  values (
    record_payment.member_id, record_payment.membership_id,
    record_payment.first_period, record_payment.amount_paise,
    record_payment.method, record_payment.paid_on,
    record_payment.receipt_number, record_payment.note
  )
  returning id into payment;
  return payment;
end;
$$;
grant execute on function public.record_payment(uuid, uuid, smallint, integer, public.payment_method, date, text, text, jsonb) to authenticated;

-- A correction: void the old entry and record the new one in its place.
create function public.correct_payment(
  target_payment uuid,
  reason text,
  amount_paise integer,
  method public.payment_method,
  paid_on date,
  receipt_number text,
  note text
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  original public.payments%rowtype;
  payment uuid;
begin
  select * into original from public.payments where id = target_payment;
  if not found then
    raise exception 'That payment no longer exists.' using errcode = 'P0002';
  end if;
  insert into public.payment_voids (payment_id, reason) values (target_payment, correct_payment.reason);
  insert into public.payments (
    member_id, membership_id, first_period, amount_paise, method,
    paid_on, receipt_number, note, replaces_payment_id
  )
  values (
    original.member_id, original.membership_id, original.first_period,
    correct_payment.amount_paise, correct_payment.method,
    correct_payment.paid_on, correct_payment.receipt_number,
    correct_payment.note, target_payment
  )
  returning id into payment;
  return payment;
end;
$$;
grant execute on function public.correct_payment(uuid, text, integer, public.payment_method, date, text, text) to authenticated;

-- ---- 2. Sums and groups -----------------------------------------------------

-- Each member's last visit and last counted payment (gone-quiet checks).
-- Trainers can't read payments, so last_payment is null for them.
create function public.member_activity()
returns table (member_id uuid, last_visit date, last_payment date)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    m.id,
    (select max(a.gym_date) from public.attendance a where a.member_id = m.id),
    (
      select max(p.paid_on) from public.payments p
      where p.member_id = m.id
        and not exists (select 1 from public.payment_voids v where v.payment_id = p.id)
    )
  from public.members m;
$$;
grant execute on function public.member_activity() to authenticated;

-- Counted payments summed per membership and first period: what list
-- screens build ledgers from (see countedTotals in src/payments/queries.ts).
create function public.counted_payment_totals()
returns table (membership_id uuid, first_period smallint, amount_paise bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select p.membership_id, p.first_period, sum(p.amount_paise)
  from public.payments p
  where not exists (select 1 from public.payment_voids v where v.payment_id = p.id)
  group by p.membership_id, p.first_period;
$$;
grant execute on function public.counted_payment_totals() to authenticated;

-- Each member's latest counted payment and their counted total this month.
create function public.latest_payments(this_month text)
returns table (member_id uuid, amount_paise integer, paid_on date, this_month_paise bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select distinct on (p.member_id)
    p.member_id,
    p.amount_paise,
    p.paid_on,
    coalesce(sum(p.amount_paise) filter (where to_char(p.paid_on, 'YYYY-MM') = this_month)
      over (partition by p.member_id), 0)
  from public.payments p
  where not exists (select 1 from public.payment_voids v where v.payment_id = p.id)
  order by p.member_id, p.paid_on desc, p.created_at desc;
$$;
grant execute on function public.latest_payments(text) to authenticated;

-- Money taken in a date range, counted payments only.
create function public.collected(from_day date, to_day date)
returns bigint
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(sum(p.amount_paise), 0)
  from public.payments p
  where p.paid_on between from_day and to_day
    and not exists (select 1 from public.payment_voids v where v.payment_id = p.id);
$$;
grant execute on function public.collected(date, date) to authenticated;

-- A month of visits: one row per day that had any, plus how many different
-- members came.
create function public.attendance_month(first_day date, last_day date)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'perDay', coalesce((
      select jsonb_agg(jsonb_build_object('day', to_char(d.gym_date, 'YYYY-MM-DD'), 'visits', d.visits) order by d.gym_date)
      from (
        select a.gym_date, count(*)::int as visits
        from public.attendance a
        where a.gym_date between first_day and last_day
        group by a.gym_date
      ) d
    ), '[]'::jsonb),
    'members', (
      select count(distinct a.member_id)::int
      from public.attendance a
      where a.gym_date between first_day and last_day
    )
  );
$$;
grant execute on function public.attendance_month(date, date) to authenticated;

-- ---- 3. The member bulletin ---------------------------------------------------

-- Same content as publish_bulletin, for anyone signed in, read on demand.
-- Not for signed-out visitors: announcements are for members only.
create function public.bulletin()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  s public.gym_settings%rowtype;
  today date := (now() at time zone 'Asia/Kolkata')::date;
  iso constant text := 'YYYY-MM-DD"T"HH24:MI:SS"Z"';
begin
  if auth.uid() is null then
    raise exception 'Sign in to see the gym''s notices' using errcode = '42501';
  end if;

  select * into s from public.gym_settings;

  return jsonb_build_object(
    -- Phones keep the newest copy they have seen; the time is newer than
    -- any version publish_bulletin handed out.
    'version', floor(extract(epoch from now()))::bigint,
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
  );
end;
$$;
grant execute on function public.bulletin() to authenticated;

-- ---- 4. The desk display's rotating code ------------------------------------

-- The desk device is signed out; the long random token in its link is the
-- credential, checked by private.desk_checkin_code as before.
create function public.desk_code(raw_token text)
returns table (code text, seconds_left integer)
language sql
volatile
security definer
set search_path = ''
as $$
  select d.code, d.seconds_left from private.desk_checkin_code(raw_token) d;
$$;
grant execute on function public.desk_code(text) to anon, authenticated;
