-- Payments are a ledger. Rows are never updated or deleted, by anyone.
-- A mistake is fixed by voiding the row (payment_voids, owner only) and, if
-- needed, recording a corrected payment that points at the one it replaces.

create type public.payment_method as enum ('cash', 'upi', 'other');

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members (id),
  amount_paise integer not null check (amount_paise > 0),
  method public.payment_method not null,
  paid_on date not null,
  -- First month this payment pays for, always the 1st of that month.
  covers_from date not null check (extract(day from covers_from) = 1),
  covers_months smallint not null default 1 check (covers_months between 1 and 24),
  receipt_number text check (length(receipt_number) <= 40),
  slip_path text,
  note text check (length(note) <= 500),
  replaces_payment_id uuid unique references public.payments (id),
  recorded_by uuid not null references public.profiles (id) default auth.uid(),
  created_at timestamptz not null default now()
);
alter table public.payments enable row level security;
revoke all on table public.payments from anon, authenticated;

create index payments_member_id_idx on public.payments (member_id);

-- Insert grants are table-wide (the ORM names every column in an insert), so
-- the time a ledger row was written is stamped here rather than trusted from
-- the client. The column name is the trigger argument.
create function public.stamp_server_time()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new := jsonb_populate_record(new, jsonb_build_object(tg_argv[0], now()));
  return new;
end;
$$;

create trigger payments_stamp_created_at
  before insert on public.payments
  for each row execute function public.stamp_server_time('created_at');

create trigger payments_audit
  after insert on public.payments
  for each row execute function public.write_audit();

create trigger payments_immutable
  before update or delete on public.payments
  for each row execute function public.reject_change();

create trigger payments_no_truncate
  before truncate on public.payments
  for each statement execute function public.reject_change();

create policy "payments: owner and manager read"
  on public.payments for select to authenticated
  using (public.has_role('owner', 'manager'));

create policy "payments: read own"
  on public.payments for select to authenticated
  using (public.is_own_member(member_id));

-- Managers record payments; only the owner may record a correction.
create policy "payments: owner and manager record"
  on public.payments for insert to authenticated
  with check (
    public.has_role('owner', 'manager')
    and recorded_by = auth.uid()
    and (replaces_payment_id is null or public.has_role('owner'))
  );

grant select on table public.payments to authenticated;
grant insert on table public.payments to authenticated;

create table public.payment_voids (
  payment_id uuid primary key references public.payments (id),
  reason text not null check (length(trim(reason)) between 3 and 500),
  voided_by uuid not null references public.profiles (id) default auth.uid(),
  voided_at timestamptz not null default now()
);
alter table public.payment_voids enable row level security;
revoke all on table public.payment_voids from anon, authenticated;

create trigger payment_voids_stamp_voided_at
  before insert on public.payment_voids
  for each row execute function public.stamp_server_time('voided_at');

create trigger payment_voids_audit
  after insert on public.payment_voids
  for each row execute function public.write_audit();

create trigger payment_voids_immutable
  before update or delete on public.payment_voids
  for each row execute function public.reject_change();

create trigger payment_voids_no_truncate
  before truncate on public.payment_voids
  for each statement execute function public.reject_change();

create policy "payment_voids: owner and manager read"
  on public.payment_voids for select to authenticated
  using (public.has_role('owner', 'manager'));

create policy "payment_voids: read own"
  on public.payment_voids for select to authenticated
  using (
    exists (
      select 1 from public.payments p
      where p.id = payment_id and public.is_own_member(p.member_id)
    )
  );

create policy "payment_voids: owner voids"
  on public.payment_voids for insert to authenticated
  with check (public.has_role('owner') and voided_by = auth.uid());

grant select on table public.payment_voids to authenticated;
grant insert on table public.payment_voids to authenticated;
