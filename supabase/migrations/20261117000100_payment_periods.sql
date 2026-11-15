-- Phase 3: payments follow each member's own due dates (brief §4.2 and §4.4,
-- owner's decision of 2026-11-15). The first payments table assumed fees fell
-- due on the 1st of each month; dues now fall on each joining-date
-- anniversary, so a payment points at a numbered period of one membership:
-- period 0 falls due on the joining day, period n on the joining date n
-- months later, pushed back by any freezes. A period number never changes
-- when a freeze is recorded later, whereas a due date would.
--
-- A payment fills its first period up to that period's agreed fee, then the
-- next, and so on. That makes partial payments (less than the fee) and
-- advances (several fees at once) the same thing. The app works this out
-- from the ledger every time; nothing derived is stored.

-- Payments are immutable, so existing rows could not be moved to the new
-- shape. No screen could record payments before this phase.
do $$
begin
  if exists (select 1 from public.payments) then
    raise exception 'public.payments must be empty before migrating to payment periods';
  end if;
end;
$$;

-- Lets a payment prove its membership belongs to the same member.
alter table public.memberships
  add constraint memberships_id_member_key unique (id, member_id);

alter table public.payments
  drop column covers_from,
  drop column covers_months,
  add column membership_id uuid not null,
  add column first_period smallint not null check (first_period between 0 and 599),
  add constraint payments_membership_matches_member
    foreign key (membership_id, member_id) references public.memberships (id, member_id),
  -- ₹1,00,000: far above any real gym payment, low enough to catch a typo.
  add constraint payments_amount_cap check (amount_paise <= 10000000);

create index payments_membership_id_idx on public.payments (membership_id);

-- A correction points at the payment it replaces, and that payment must
-- already be voided (both happen in one transaction), so the ledger never
-- counts the old and the new amount together.
create function public.require_replaced_payment_voided()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.replaces_payment_id is not null and not exists (
    select 1 from public.payment_voids v where v.payment_id = new.replaces_payment_id
  ) then
    raise exception 'Void the old payment before recording its correction' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger payments_replace_only_voided
  before insert on public.payments
  for each row execute function public.require_replaced_payment_voided();

-- Moving a start date would move every due date and silently re-file
-- payments already made against them. Nothing in the app edits it; a wrong
-- start date is fixed by ending the membership and starting a new one.
revoke update (starts_on) on table public.memberships from authenticated;
