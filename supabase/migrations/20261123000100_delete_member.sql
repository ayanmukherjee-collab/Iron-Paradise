-- Permanent deletion of a member (owner's decision of 2026-11-17).
--
-- "Mark inactive" is still the everyday way to remove someone: it keeps their
-- history. Deleting is for when a person must be gone from the database
-- entirely: their member row, every membership, fee, freeze, payment, void,
-- visit, claim link and reminder, and every audit entry that copied any of
-- those rows. One audit entry stays behind saying the owner deleted member
-- IP-0042, with no UUID, name or phone number in it.
--
-- The guard triggers that make these tables append-only stay in place. They
-- let a DELETE through only while public.delete_member is running, which it
-- signals with a row in private.member_purges keyed by its own transaction
-- id. No app role can read or write the private schema, so nothing else can
-- raise that flag, and the function clears it before it returns so the rest
-- of the caller's transaction is guarded again.
--
-- Safety catches, all checked inside the database:
--   * owner only;
--   * the member must already be marked inactive, so deleting is always a
--     second, deliberate step;
--   * the caller must type the member's ID (IP-0042), so a stray tap or a
--     forged request with only the UUID does nothing.

create table private.member_purges (
  txid bigint primary key
);
alter table private.member_purges enable row level security;

-- Same guard as before, plus the one way through. security definer so the
-- check can read private.member_purges whoever fired the trigger.
create or replace function public.reject_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    if exists (select 1 from private.member_purges where txid = txid_current()) then
      return old;
    end if;
  end if;
  raise exception '% is append-only', tg_table_name using errcode = '42501';
end;
$$;
revoke all on function public.reject_change() from public, anon, authenticated;

create function public.delete_member(target uuid, confirm_code text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  m public.members%rowtype;
  membership_ids uuid[];
  payment_ids uuid[];
  record_ids text[];
begin
  if not public.has_role('owner') then
    raise exception 'Only the owner can delete members' using errcode = '42501';
  end if;

  select * into m from public.members where id = target for update;
  if not found then
    raise exception 'That member no longer exists' using errcode = 'P0002';
  end if;
  if upper(btrim(coalesce(confirm_code, ''))) <> m.member_code then
    raise exception 'Type the member ID exactly as shown to confirm' using errcode = 'P0001';
  end if;
  if m.is_active then
    raise exception 'Mark the member inactive before deleting them' using errcode = 'P0001';
  end if;

  select coalesce(array_agg(id), '{}') into membership_ids
  from public.memberships where member_id = target;
  select coalesce(array_agg(id), '{}') into payment_ids
  from public.payments where member_id = target;

  -- A correction always belongs to the same member as the payment it
  -- replaces, but nothing enforces that, so say so plainly rather than fail
  -- on a foreign key.
  if exists (
    select 1 from public.payments
    where replaces_payment_id = any (payment_ids) and member_id <> target
  ) then
    raise exception 'Another member''s payment corrects one of this member''s payments' using errcode = 'P0001';
  end if;

  -- Every id whose audit entries describe this member. Voids are logged
  -- under their payment's id.
  record_ids := array[target::text]
    || membership_ids::text[]
    || payment_ids::text[]
    || array(select id::text from public.membership_fees where membership_id = any (membership_ids))
    || array(select id::text from public.membership_freezes where membership_id = any (membership_ids));

  insert into private.member_purges (txid) values (txid_current());

  -- Children first, so every foreign key is satisfied at each step.
  delete from public.notifications where member_id = target;
  delete from public.attendance where member_id = target;
  delete from public.claim_tokens where member_id = target;
  delete from public.payment_voids where payment_id = any (payment_ids);
  delete from public.payments where member_id = target;
  delete from public.membership_fees where membership_id = any (membership_ids);
  delete from public.membership_freezes where membership_id = any (membership_ids);
  delete from public.memberships where member_id = target;
  delete from public.members where id = target;
  delete from public.audit_log
  where table_name in ('members', 'memberships', 'membership_fees',
                       'membership_freezes', 'payments', 'payment_voids')
    and record_id = any (record_ids);

  delete from private.member_purges where txid = txid_current();

  -- The linked app account stays (it is a Google sign-in, not gym data) but
  -- goes back to waiting as a guest. Staff accounts keep their role.
  if m.profile_id is not null then
    update public.profiles set role = 'guest'
    where id = m.profile_id and role = 'member';
  end if;

  insert into public.audit_log (actor_id, table_name, record_id, action, before, after)
  values (auth.uid(), 'members', m.member_code, 'delete',
          jsonb_build_object('member_code', m.member_code), null);

  return m.member_code;
end;
$$;

revoke all on function public.delete_member(uuid, text) from public, anon;
grant execute on function public.delete_member(uuid, text) to authenticated;
