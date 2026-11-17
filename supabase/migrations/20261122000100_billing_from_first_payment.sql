-- Dues follow the first payment, not the joining day (owner's decision of
-- 2026-11-17). Someone who joins on 6 Jan and first pays on 8 Jan falls due
-- on the 8th of every month after that.
--
-- billing_starts_on is the day period 0 falls due; period n falls due n
-- months later (pushed back by freezes, as before). It is null until the
-- first payment, and the app treats null as the joining day, so a new member
-- shows as due from the day they join. A payment dated before the joining
-- day does not pull dues earlier than the membership itself.
--
-- It is kept here, not worked out in the app, because trainers see due dates
-- but may not read payments. Only these triggers write it: voiding the first
-- payment (say, typed with the wrong date) moves dues to whichever payment
-- is now the first, so recording the correction fixes the schedule.
-- Payments still point at period numbers, so none is re-filed.

alter table public.memberships add column billing_starts_on date;

create function public.refresh_billing_start(target uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  first_paid date;
  anchor date;
begin
  select min(p.paid_on) into first_paid
  from public.payments p
  where p.membership_id = target
    and not exists (
      select 1 from public.payment_voids v where v.payment_id = p.id
    );

  select case when first_paid is null then null
              else greatest(ms.starts_on, first_paid) end
  into anchor
  from public.memberships ms
  where ms.id = target;

  -- Only a real change is written, so the audit log records when dues move.
  update public.memberships
  set billing_starts_on = anchor
  where id = target and billing_starts_on is distinct from anchor;
end;
$$;
revoke all on function public.refresh_billing_start(uuid) from public, anon, authenticated;

create function public.payments_refresh_billing_start()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.refresh_billing_start(new.membership_id);
  return null;
end;
$$;

create trigger payments_refresh_billing_start
  after insert on public.payments
  for each row execute function public.payments_refresh_billing_start();

create function public.payment_voids_refresh_billing_start()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.refresh_billing_start(
    (select p.membership_id from public.payments p where p.id = new.payment_id)
  );
  return null;
end;
$$;

create trigger payment_voids_refresh_billing_start
  after insert on public.payment_voids
  for each row execute function public.payment_voids_refresh_billing_start();

-- Memberships that already have payments move to their first payment's day.
select public.refresh_billing_start(ms.id) from public.memberships ms;
