-- The yearly close: keep 12 to 24 months of detail, sum up the rest.
--
-- Every 1 April (the start of the Indian financial year) the year-close
-- Edge Function sums everything dated before the previous 1 April into the
-- *_totals tables below, then deletes those rows: visits, payments and
-- their voids, the reminder log, finished claim links and the audit log.
-- So the busy tables never hold more than two years, and screens that show
-- recent months (all of them) are never left empty.
--
-- Payments can't simply go: a member's balance is worked out from every
-- payment since they joined. The Edge Function replaces a membership's old
-- payments with one carried-forward entry, after checking with the app's
-- own ledger code that the balance, every month's paid amount and the due
-- dates come out exactly the same (and keeps one entry per starting month
-- when one entry wouldn't). private.close_year checks the money adds up,
-- writes the totals and deletes, all in one transaction.
--
-- Also here: the last policies that still called a role check once per row
-- (inserts and updates) now call it once per statement, and an index for
-- the money-by-date sums.

-- ---- 1. Policies: role checks once per statement ---------------------------

alter policy "attendance: staff mark" on public.attendance
  with check (
    (select public.is_staff())
    and marked_by = (select auth.uid())
    and method = 'manual'
  );

alter policy "gym_settings: owner edits" on public.gym_settings
  using ((select public.has_role('owner')))
  with check ((select public.has_role('owner')));

alter policy "members: owner and manager add" on public.members
  with check (
    (select public.has_role('owner', 'manager'))
    and created_by = (select auth.uid())
    and profile_id is null
  );

alter policy "membership_fees: owner and manager set" on public.membership_fees
  with check (
    (select public.has_role('owner', 'manager'))
    and set_by = (select auth.uid())
  );

alter policy "membership_freezes: owner and manager add" on public.membership_freezes
  with check (
    (select public.has_role('owner', 'manager'))
    and created_by = (select auth.uid())
  );

alter policy "memberships: owner and manager add" on public.memberships
  with check (
    (select public.has_role('owner', 'manager'))
    and created_by = (select auth.uid())
  );

alter policy "payment_voids: owner voids" on public.payment_voids
  with check (
    (select public.has_role('owner'))
    and voided_by = (select auth.uid())
  );

alter policy "plans: owner adds" on public.plans
  with check ((select public.has_role('owner')));

alter policy "plans: owner edits" on public.plans
  using ((select public.has_role('owner')))
  with check ((select public.has_role('owner')));

-- ---- 2. Carried-forward payments -------------------------------------------

alter table public.payments
  add column carried_forward boolean not null default false;

-- Only the yearly close writes one; staff never can.
alter policy "payments: owner and manager record" on public.payments
  with check (
    (select public.has_role('owner', 'manager'))
    and recorded_by = (select auth.uid())
    and (replaces_payment_id is null or (select public.has_role('owner')))
    and not carried_forward
  );

-- Money taken in a date range, and each member's latest payment, count real
-- payments only: a carried-forward entry is old money already summed.
create index payments_paid_on_idx on public.payments (paid_on);

create or replace function public.collected(from_day date, to_day date)
returns bigint
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(sum(p.amount_paise), 0)
  from public.payments p
  where p.paid_on between from_day and to_day
    and not p.carried_forward
    and not exists (select 1 from public.payment_voids v where v.payment_id = p.id);
$$;

create or replace function public.latest_payments(this_month text)
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
  where not p.carried_forward
    and not exists (select 1 from public.payment_voids v where v.payment_id = p.id)
  order by p.member_id, p.paid_on desc, p.created_at desc;
$$;

-- ---- 3. What stays after a close -------------------------------------------

-- Visits and joiners per month. Staff can read these, as they can visits.
create table public.monthly_visit_totals (
  month date primary key check (extract(day from month) = 1),
  check_ins integer not null default 0,
  members_visited integer not null default 0,
  joined integer not null default 0
);

-- Money per month. Owner and manager only, as payments are.
create table public.monthly_payment_totals (
  month date primary key check (extract(day from month) = 1),
  collected_paise bigint not null default 0,
  payments integer not null default 0,
  cash_paise bigint not null default 0,
  upi_paise bigint not null default 0,
  other_paise bigint not null default 0
);

-- Each member's visits and payments before the last close.
create table public.member_visit_totals (
  member_id uuid primary key references public.members (id) on delete cascade,
  visits integer not null default 0,
  first_visit_on date,
  last_visit_on date
);

create table public.member_payment_totals (
  member_id uuid primary key references public.members (id) on delete cascade,
  paid_paise bigint not null default 0,
  payments integer not null default 0,
  last_paid_on date
);

-- One row per close: everything before `cutoff` is in the totals above.
create table public.year_closes (
  cutoff date primary key check (extract(day from cutoff) = 1),
  closed_at timestamptz not null default now(),
  summary jsonb not null
);

alter table public.monthly_visit_totals enable row level security;
alter table public.monthly_payment_totals enable row level security;
alter table public.member_visit_totals enable row level security;
alter table public.member_payment_totals enable row level security;
alter table public.year_closes enable row level security;

revoke all on table public.monthly_visit_totals, public.monthly_payment_totals,
  public.member_visit_totals, public.member_payment_totals, public.year_closes
  from anon, authenticated;
grant select on table public.monthly_visit_totals, public.monthly_payment_totals,
  public.member_visit_totals, public.member_payment_totals, public.year_closes
  to authenticated;

create policy "monthly_visit_totals: staff read" on public.monthly_visit_totals
  for select to authenticated using ((select public.is_staff()));
create policy "member_visit_totals: staff read" on public.member_visit_totals
  for select to authenticated using ((select public.is_staff()));
create policy "monthly_payment_totals: owner and manager read" on public.monthly_payment_totals
  for select to authenticated using ((select public.has_role('owner', 'manager')));
create policy "member_payment_totals: owner and manager read" on public.member_payment_totals
  for select to authenticated using ((select public.has_role('owner', 'manager')));
create policy "year_closes: owner and manager read" on public.year_closes
  for select to authenticated using ((select public.has_role('owner', 'manager')));

-- Gone-quiet checks look at the last visit and payment, which may now be
-- in the totals rather than the detail.
create or replace function public.member_activity()
returns table (member_id uuid, last_visit date, last_payment date)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    m.id,
    greatest(
      (select max(a.gym_date) from public.attendance a where a.member_id = m.id),
      (select vt.last_visit_on from public.member_visit_totals vt where vt.member_id = m.id)
    ),
    greatest(
      (
        select max(p.paid_on) from public.payments p
        where p.member_id = m.id
          and not p.carried_forward
          and not exists (select 1 from public.payment_voids v where v.payment_id = p.id)
      ),
      (select pt.last_paid_on from public.member_payment_totals pt where pt.member_id = m.id)
    )
  from public.members m;
$$;

-- ---- 4. The close itself ---------------------------------------------------

-- `carries` comes from the Edge Function, one entry per membership with
-- payments before the cut-off:
--   { "membershipId": uuid, "deleteIds": [uuid, …],
--     "carry": [{ "firstPeriod": n, "amountPaise": n }, …] }
-- Runs as the database owner only: no app role can call it.
create function private.close_year(before_day date, carries jsonb)
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
                bool_and((piece ->> 'amountPaise')::bigint > 0) as positive
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
    (member_id, membership_id, first_period, amount_paise, method, paid_on,
     note, recorded_by, carried_forward)
  select ms.member_id,
         ms.id,
         (piece ->> 'firstPeriod')::smallint,
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

-- ---- 5. Where the full detail goes first, and when it runs -----------------

-- The Edge Function saves each closed year's payments and check-ins here
-- as CSV before deleting them. Private: no policies, so only the service
-- role (the Edge Function, and the dashboard) can read it.
do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'storage') then
    insert into storage.buckets (id, name, public)
    values ('archives', 'archives', false)
    on conflict (id) do nothing;
  end if;
end;
$$;

-- 06:00 India time on 1–7 April: the first run closes the year, the rest
-- find it closed and stop (a spare in case the first fails). Uses the same
-- shared secret as the reminders. Skipped where pg_cron isn't installed.
do $do$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron')
     and exists (select 1 from pg_extension where extname = 'pg_net') then
    perform cron.schedule(
      'year-close',
      '30 0 1-7 4 *',
      $cron$
      select net.http_post(
        url := 'https://lttffxniaxxbstiaxvvz.supabase.co/functions/v1/year-close',
        headers := jsonb_build_object(
          'Authorization', 'Bearer ' || (
            select decrypted_secret from vault.decrypted_secrets
            where name = 'reminders_cron_secret'
          )
        ),
        timeout_milliseconds := 120000
      );
      $cron$
    );
  end if;
end;
$do$;
