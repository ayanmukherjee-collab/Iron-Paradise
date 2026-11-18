-- Paying by months (owner's decision of 2026-11-18).
--
-- A payment is now the money received plus how many months it pays for
-- (one of the plans). It pays for exactly those months, whatever the
-- amount; the amount is only a record of money taken, for the totals and
-- charts. Plans lose their price: they are just a name and a length.
--
-- The owner asked for every payment recorded so far to be wiped: they were
-- messy and would spoil the charts. private.reset_payments does that once,
-- run by hand with a plan worked out by the app's own ledger code
-- (scripts/reset-payments.ts): each membership's dues restart at the first
-- month its old payments left unpaid, so nobody who was paid up becomes
-- overdue and nobody who owed is let off, with no stand-in payments left
-- behind to show up in the charts.

-- ---- 1. Months on payments -------------------------------------------------

-- Existing rows get 1 for now; private.reset_payments removes them all.
-- Carried-forward entries from the yearly close can span many plans.
alter table public.payments
  add column months smallint not null default 1
  check (months between 1 and 600);

drop function public.record_payment(uuid, uuid, smallint, integer, public.payment_method, date, text, text, jsonb);

create function public.record_payment(
  member_id uuid,
  membership_id uuid,
  first_period smallint,
  months smallint,
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
  if record_payment.months is null or record_payment.months not between 1 and 24 then
    raise exception 'Pick how long this pays for.' using errcode = 'P0001';
  end if;
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
    member_id, membership_id, first_period, months, amount_paise, method,
    paid_on, receipt_number, note
  )
  values (
    record_payment.member_id, record_payment.membership_id,
    record_payment.first_period, record_payment.months,
    record_payment.amount_paise, record_payment.method,
    record_payment.paid_on, record_payment.receipt_number, record_payment.note
  )
  returning id into payment;
  return payment;
end;
$$;
grant execute on function public.record_payment(uuid, uuid, smallint, smallint, integer, public.payment_method, date, text, text, jsonb) to authenticated;

-- A correction keeps the months it paid for; only the money and details change.
create or replace function public.correct_payment(
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
    member_id, membership_id, first_period, months, amount_paise, method,
    paid_on, receipt_number, note, replaces_payment_id
  )
  values (
    original.member_id, original.membership_id, original.first_period,
    original.months, correct_payment.amount_paise, correct_payment.method,
    correct_payment.paid_on, correct_payment.receipt_number,
    correct_payment.note, target_payment
  )
  returning id into payment;
  return payment;
end;
$$;

-- List screens build ledgers from one row per membership and first month:
-- payments starting on the same month pay for as many months as the
-- longest of them.
drop function public.counted_payment_totals();
create function public.counted_payment_totals()
returns table (membership_id uuid, first_period smallint, months smallint, amount_paise bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select p.membership_id, p.first_period, max(p.months), sum(p.amount_paise)
  from public.payments p
  where not exists (select 1 from public.payment_voids v where v.payment_id = p.id)
  group by p.membership_id, p.first_period;
$$;
grant execute on function public.counted_payment_totals() to authenticated;

-- ---- 2. Plans are a name and a length --------------------------------------

alter table public.plans drop column default_fee_paise;

-- ---- 3. The yearly close carries months -----------------------------------

-- Each carried-forward entry now says which months it pays for:
--   "carry": [{ "firstPeriod": n, "months": n, "amountPaise": n }, …]
create or replace function private.close_year(before_day date, carries jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  gym_today date := (now() at time zone 'Asia/Kolkata')::date;
  last_cutoff date;
  delete_ids uuid[];
  problem text;
  summary jsonb;
  n_carried integer;
  n_payments integer;
  n_voids integer;
  n_visits integer;
  n_notifications integer;
  n_claims integer;
  n_audit integer;
begin
  if before_day is null or extract(day from before_day) <> 1 then
    raise exception 'The cut-off must be the first day of a month' using errcode = 'P0001';
  end if;
  if before_day > (gym_today - interval '1 year')::date then
    raise exception 'The last twelve months are always kept (cut-off % is too recent)', before_day
      using errcode = 'P0001';
  end if;

  -- One close at a time, and each cut-off once.
  perform pg_advisory_xact_lock(hashtext('private.close_year'));
  select max(y.cutoff) into last_cutoff from public.year_closes y;
  if last_cutoff is not null and before_day <= last_cutoff then
    return jsonb_build_object('skipped', true, 'closedBefore', last_cutoff);
  end if;

  carries := coalesce(carries, '[]'::jsonb);

  -- ---- Check the plan before touching anything ----
  select coalesce(array_agg(distinct x::uuid), '{}') into delete_ids
  from jsonb_array_elements(carries) e,
       jsonb_array_elements_text(e -> 'deleteIds') x;

  select format('payment %s is missing, belongs elsewhere or is too recent', i.id)
  into problem
  from jsonb_array_elements(carries) e,
       lateral (select x::uuid as id from jsonb_array_elements_text(e -> 'deleteIds') x) i
  left join public.payments p on p.id = i.id
  where p.id is null
     or p.membership_id <> (e ->> 'membershipId')::uuid
     or p.paid_on >= before_day
  limit 1;
  if problem is not null then
    raise exception 'Year close refused: %', problem using errcode = 'P0001';
  end if;

  if (select count(*) from jsonb_array_elements(carries))
     <> (select count(distinct e ->> 'membershipId') from jsonb_array_elements(carries) e) then
    raise exception 'Year close refused: a membership is listed twice' using errcode = 'P0001';
  end if;

  -- The carried-forward entries must hold exactly the counted money they replace.
  select format('membership %s: %s counted, %s carried', e ->> 'membershipId', counted, carried)
  into problem
  from jsonb_array_elements(carries) e,
       lateral (
         select coalesce(sum(p.amount_paise), 0) as counted
         from public.payments p
         where p.id in (select x::uuid from jsonb_array_elements_text(e -> 'deleteIds') x)
           and not exists (select 1 from public.payment_voids v where v.payment_id = p.id)
       ) c,
       lateral (
         select coalesce(sum((piece ->> 'amountPaise')::bigint), 0) as carried,
                bool_and((piece ->> 'amountPaise')::bigint > 0
                         and (piece ->> 'months')::int between 1 and 600) as positive
         from jsonb_array_elements(e -> 'carry') piece
       ) k
  where c.counted <> k.carried or k.positive is false
  limit 1;
  if problem is not null then
    raise exception 'Year close refused: %', problem using errcode = 'P0001';
  end if;

  -- A correction that stays can't lose the payment it replaced.
  if exists (
    select 1 from public.payments k
    where k.replaces_payment_id = any (delete_ids) and not (k.id = any (delete_ids))
  ) then
    raise exception 'Year close refused: a kept correction points at a payment being removed'
      using errcode = 'P0001';
  end if;

  -- ---- Totals, from the rows about to go ----
  insert into public.monthly_visit_totals as t (month, check_ins, members_visited)
  select date_trunc('month', a.gym_date)::date, count(*), count(distinct a.member_id)
  from public.attendance a
  where a.gym_date < before_day
  group by 1
  on conflict (month) do update
    set check_ins = t.check_ins + excluded.check_ins,
        members_visited = t.members_visited + excluded.members_visited;

  -- Members stay, so only those who joined since the last close are new.
  insert into public.monthly_visit_totals as t (month, joined)
  select date_trunc('month', (m.created_at at time zone 'Asia/Kolkata')::date)::date, count(*)
  from public.members m
  where (m.created_at at time zone 'Asia/Kolkata')::date < before_day
    and (last_cutoff is null or (m.created_at at time zone 'Asia/Kolkata')::date >= last_cutoff)
  group by 1
  on conflict (month) do update set joined = t.joined + excluded.joined;

  insert into public.monthly_payment_totals as t
    (month, collected_paise, payments, cash_paise, upi_paise, other_paise)
  select date_trunc('month', p.paid_on)::date,
         sum(p.amount_paise),
         count(*),
         coalesce(sum(p.amount_paise) filter (where p.method = 'cash'), 0),
         coalesce(sum(p.amount_paise) filter (where p.method = 'upi'), 0),
         coalesce(sum(p.amount_paise) filter (where p.method = 'other'), 0)
  from public.payments p
  where p.id = any (delete_ids)
    and not p.carried_forward
    and not exists (select 1 from public.payment_voids v where v.payment_id = p.id)
  group by 1
  on conflict (month) do update
    set collected_paise = t.collected_paise + excluded.collected_paise,
        payments = t.payments + excluded.payments,
        cash_paise = t.cash_paise + excluded.cash_paise,
        upi_paise = t.upi_paise + excluded.upi_paise,
        other_paise = t.other_paise + excluded.other_paise;

  insert into public.member_visit_totals as t (member_id, visits, first_visit_on, last_visit_on)
  select a.member_id, count(*), min(a.gym_date), max(a.gym_date)
  from public.attendance a
  where a.gym_date < before_day
  group by 1
  on conflict (member_id) do update
    set visits = t.visits + excluded.visits,
        first_visit_on = least(t.first_visit_on, excluded.first_visit_on),
        last_visit_on = greatest(t.last_visit_on, excluded.last_visit_on);

  insert into public.member_payment_totals as t (member_id, paid_paise, payments, last_paid_on)
  select p.member_id, sum(p.amount_paise), count(*), max(p.paid_on)
  from public.payments p
  where p.id = any (delete_ids)
    and not p.carried_forward
    and not exists (select 1 from public.payment_voids v where v.payment_id = p.id)
  group by 1
  on conflict (member_id) do update
    set paid_paise = t.paid_paise + excluded.paid_paise,
        payments = t.payments + excluded.payments,
        last_paid_on = greatest(t.last_paid_on, excluded.last_paid_on);

  -- ---- Carried-forward entries, before the old rows go ----
  -- Dated on the membership's earliest counted payment, so the due day
  -- (memberships.billing_starts_on, the earliest counted payment's day)
  -- stays exactly where it is.
  insert into public.payments
    (member_id, membership_id, first_period, months, amount_paise, method,
     paid_on, note, recorded_by, carried_forward)
  select ms.member_id,
         ms.id,
         (piece ->> 'firstPeriod')::smallint,
         (piece ->> 'months')::smallint,
         (piece ->> 'amountPaise')::integer,
         'other',
         old.first_paid,
         format('Carried forward: %s %s before %s', old.n,
                case when old.n = 1 then 'payment' else 'payments' end,
                to_char(before_day, 'FMDD Mon YYYY')),
         old.recorder,
         true
  from jsonb_array_elements(carries) e
  join public.memberships ms on ms.id = (e ->> 'membershipId')::uuid
  cross join lateral (
    select min(p.paid_on) as first_paid,
           count(*) as n,
           (array_agg(p.recorded_by order by p.created_at desc))[1] as recorder
    from public.payments p
    where p.id in (select x::uuid from jsonb_array_elements_text(e -> 'deleteIds') x)
      and not exists (select 1 from public.payment_voids v where v.payment_id = p.id)
  ) old
  cross join jsonb_array_elements(e -> 'carry') piece;
  get diagnostics n_carried = row_count;

  -- ---- Delete (the guard triggers let deletes through while this flag is up) ----
  insert into private.member_purges (txid) values (txid_current()) on conflict do nothing;

  delete from public.payment_voids where payment_id = any (delete_ids);
  get diagnostics n_voids = row_count;
  delete from public.payments where id = any (delete_ids);
  get diagnostics n_payments = row_count;
  delete from public.attendance where gym_date < before_day;
  get diagnostics n_visits = row_count;
  delete from public.notifications
  where (created_at at time zone 'Asia/Kolkata')::date < before_day;
  get diagnostics n_notifications = row_count;
  delete from public.claim_tokens
  where (created_at at time zone 'Asia/Kolkata')::date < before_day
    and (used_at is not null or revoked_at is not null or expires_at < now());
  get diagnostics n_claims = row_count;
  delete from public.audit_log
  where (occurred_at at time zone 'Asia/Kolkata')::date < before_day;
  get diagnostics n_audit = row_count;

  delete from private.member_purges where txid = txid_current();

  summary := jsonb_build_object(
    'cutoff', before_day,
    'carriedForward', n_carried,
    'payments', n_payments,
    'voids', n_voids,
    'visits', n_visits,
    'notifications', n_notifications,
    'claimLinks', n_claims,
    'auditEntries', n_audit
  );
  insert into public.year_closes (cutoff, summary) values (before_day, summary);
  insert into public.audit_log (actor_id, table_name, record_id, action, before, after)
  values (null, 'year_closes', before_day::text, 'insert', null, summary);

  return summary;
end;
$$;
revoke all on function private.close_year(date, jsonb) from public, anon, authenticated;

-- ---- 4. Wiping the old payments, once --------------------------------------

-- `plans` comes from scripts/reset-payments.ts, one entry per membership
-- that has payments or whose dues follow its first payment:
--   { "membershipId": uuid, "shift": n,
--     "dueChanges": [{ "from_period": n, "due_on": "yyyy-mm-dd" }, …] }
-- dueChanges restart the dues at the first unpaid month (period `shift`
-- under the old payments), which becomes period 0. The reminder log is
-- renumbered to match: reminders about months that were paid go, the rest
-- keep their place so nobody is reminded twice.
--
-- Refuses if anything was paid or voided after `snapshot` (the moment the
-- plan was worked out), or if the plan misses a membership that needs one.
-- Runs as the database owner only.
create function private.reset_payments(snapshot timestamptz, plans jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  missing uuid;
  n_payments integer;
  n_voids integer;
  n_memberships integer;
  n_reminders_dropped integer;
  summary jsonb;
begin
  perform pg_advisory_xact_lock(hashtext('private.reset_payments'));
  plans := coalesce(plans, '[]'::jsonb);

  if exists (select 1 from public.payments where created_at > snapshot)
     or exists (select 1 from public.payment_voids where voided_at > snapshot) then
    raise exception 'Reset refused: payments changed after the plan was made. Make it again.'
      using errcode = 'P0001';
  end if;
  if (select count(*) from jsonb_array_elements(plans))
     <> (select count(distinct e ->> 'membershipId') from jsonb_array_elements(plans) e) then
    raise exception 'Reset refused: a membership is listed twice' using errcode = 'P0001';
  end if;

  -- Every membership whose dues came from payments must get a new schedule.
  select ms.id into missing
  from public.memberships ms
  where (ms.billing_starts_on is not null
         or exists (select 1 from public.payments p where p.membership_id = ms.id))
    and not exists (
      select 1 from jsonb_array_elements(plans) e
      where (e ->> 'membershipId')::uuid = ms.id
    )
  limit 1;
  if missing is not null then
    raise exception 'Reset refused: no plan for membership %', missing using errcode = 'P0001';
  end if;

  insert into private.member_purges (txid) values (txid_current()) on conflict do nothing;

  delete from public.payment_voids;
  get diagnostics n_voids = row_count;
  delete from public.payments;
  get diagnostics n_payments = row_count;
  -- Nothing has been closed yet, but these would hold old money too.
  delete from public.member_payment_totals;
  delete from public.monthly_payment_totals;

  update public.memberships ms
  set due_changes = e -> 'dueChanges',
      billing_starts_on = null
  from jsonb_array_elements(plans) e
  where ms.id = (e ->> 'membershipId')::uuid;
  get diagnostics n_memberships = row_count;

  -- The reminder log, renumbered: taken out and put back with each row's
  -- original time (the stamp trigger would set it to now).
  create temporary table renumbered on commit drop as
  select n.*
  from public.notifications n
  join jsonb_array_elements(plans) e on (e ->> 'membershipId')::uuid = n.membership_id
  where n.period >= (e ->> 'shift')::int;
  update renumbered r
  set period = r.period - (e ->> 'shift')::int
  from jsonb_array_elements(plans) e
  where (e ->> 'membershipId')::uuid = r.membership_id;

  delete from public.notifications n
  using jsonb_array_elements(plans) e
  where (e ->> 'membershipId')::uuid = n.membership_id;
  get diagnostics n_reminders_dropped = row_count;

  alter table public.notifications disable trigger notifications_stamp_created_at;
  insert into public.notifications select * from renumbered;
  alter table public.notifications enable trigger notifications_stamp_created_at;
  n_reminders_dropped := n_reminders_dropped - (select count(*) from renumbered);

  delete from private.member_purges where txid = txid_current();

  summary := jsonb_build_object(
    'payments', n_payments,
    'voids', n_voids,
    'memberships', n_memberships,
    'remindersDropped', n_reminders_dropped
  );
  insert into public.audit_log (actor_id, table_name, record_id, action, before, after)
  values (null, 'payments', 'reset-payments', 'delete', null, summary);
  return summary;
end;
$$;
revoke all on function private.reset_payments(timestamptz, jsonb) from public, anon, authenticated;
