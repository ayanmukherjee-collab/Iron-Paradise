-- Analytics: one row per month for the last year (or any span up to five
-- years), summed in the database so the page downloads twelve small rows
-- instead of every check-in and payment.
--
-- Months the yearly close has already summed (before year_closes.cutoff)
-- read the *_totals tables; later months read the live rows. Members and
-- memberships are never closed, so the member count always comes from them.
--
-- Security invoker: each row is only what the caller may read. Owners and
-- managers see everything; anyone else gets zeros for what RLS hides.

create function public.monthly_analytics(last_month date, months integer default 12)
returns table (
  month date,
  -- Members holding an open membership on the month's last day (or today,
  -- for the current month).
  members integer,
  -- Members added that month: new admissions.
  joined integer,
  check_ins integer,
  members_visited integer,
  -- Money taken that month (voided and carried-forward entries skipped).
  collected_paise bigint,
  payments integer,
  cash_paise bigint,
  upi_paise bigint,
  other_paise bigint,
  -- Payments voided that month: a wrong entry corrected or cancelled.
  corrections integer
)
language sql
stable
security invoker
set search_path = ''
as $$
  with span as (
    select (date_trunc('month', last_month) - make_interval(months => n))::date as month
    from generate_series(least(greatest(coalesce(months, 12), 1), 60) - 1, 0, -1) n
  ),
  bounds as (
    select min(month) as first_month,
           (max(month) + interval '1 month')::date as end_day,
           (select max(y.cutoff) from public.year_closes y) as closed_before
    from span
  ),
  visits as (
    select date_trunc('month', a.gym_date)::date as month,
           count(*)::integer as check_ins,
           count(distinct a.member_id)::integer as members_visited
    from public.attendance a, bounds b
    where a.gym_date >= b.first_month and a.gym_date < b.end_day
    group by 1
  ),
  money as (
    select date_trunc('month', p.paid_on)::date as month,
           sum(p.amount_paise)::bigint as collected_paise,
           count(*)::integer as payments,
           coalesce(sum(p.amount_paise) filter (where p.method = 'cash'), 0)::bigint as cash_paise,
           coalesce(sum(p.amount_paise) filter (where p.method = 'upi'), 0)::bigint as upi_paise,
           coalesce(sum(p.amount_paise) filter (where p.method = 'other'), 0)::bigint as other_paise
    from public.payments p, bounds b
    where p.paid_on >= b.first_month and p.paid_on < b.end_day
      and not p.carried_forward
      and not exists (select 1 from public.payment_voids v where v.payment_id = p.id)
    group by 1
  ),
  voids as (
    select date_trunc('month', (v.voided_at at time zone 'Asia/Kolkata')::date)::date as month,
           count(*)::integer as corrections
    from public.payment_voids v, bounds b
    where (v.voided_at at time zone 'Asia/Kolkata')::date >= b.first_month
      and (v.voided_at at time zone 'Asia/Kolkata')::date < b.end_day
    group by 1
  ),
  joins as (
    select date_trunc('month', (m.created_at at time zone 'Asia/Kolkata')::date)::date as month,
           count(*)::integer as joined
    from public.members m, bounds b
    where (m.created_at at time zone 'Asia/Kolkata')::date >= b.first_month
      and (m.created_at at time zone 'Asia/Kolkata')::date < b.end_day
    group by 1
  ),
  held as (
    select s.month,
           count(distinct ms.member_id)::integer as members
    from span s
    join public.memberships ms
      on ms.starts_on < (s.month + interval '1 month')::date
     and (ms.ended_on is null or ms.ended_on >= (s.month + interval '1 month')::date)
    group by 1
  )
  select
    s.month,
    coalesce(h.members, 0),
    case when s.month < b.closed_before then coalesce(vt.joined, 0) else coalesce(j.joined, 0) end,
    case when s.month < b.closed_before then coalesce(vt.check_ins, 0) else coalesce(v.check_ins, 0) end,
    case when s.month < b.closed_before then coalesce(vt.members_visited, 0) else coalesce(v.members_visited, 0) end,
    case when s.month < b.closed_before then coalesce(pt.collected_paise, 0) else coalesce(mo.collected_paise, 0) end,
    case when s.month < b.closed_before then coalesce(pt.payments, 0) else coalesce(mo.payments, 0) end,
    case when s.month < b.closed_before then coalesce(pt.cash_paise, 0) else coalesce(mo.cash_paise, 0) end,
    case when s.month < b.closed_before then coalesce(pt.upi_paise, 0) else coalesce(mo.upi_paise, 0) end,
    case when s.month < b.closed_before then coalesce(pt.other_paise, 0) else coalesce(mo.other_paise, 0) end,
    coalesce(vo.corrections, 0)
  from span s
  cross join bounds b
  left join held h on h.month = s.month
  left join joins j on j.month = s.month
  left join visits v on v.month = s.month
  left join money mo on mo.month = s.month
  left join voids vo on vo.month = s.month
  left join public.monthly_visit_totals vt on vt.month = s.month
  left join public.monthly_payment_totals pt on pt.month = s.month
  order by s.month;
$$;

revoke all on function public.monthly_analytics(date, integer) from public, anon;
grant execute on function public.monthly_analytics(date, integer) to authenticated;
