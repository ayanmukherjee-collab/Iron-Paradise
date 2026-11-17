-- Erasing a member (owner's decision of 2026-11-17, replacing brief §3's
-- "members are never hard-deleted"). "Mark inactive" stays the normal way to
-- remove someone. Erasing is for when the person must be gone entirely:
-- their member record, memberships, fees, freezes, payments, voids, visits,
-- claim links, reminder log and every audit entry about any of them are
-- deleted, so their member id appears nowhere in the database afterwards.
--
-- Every one of those tables refuses deletes through public.reject_change(),
-- and app roles hold no DELETE privilege on any of them. Both stay that way.
-- reject_change() lets a DELETE through only while public.erase_member() has
-- set a transaction-local flag. Only a role that already holds DELETE (the
-- table owner, which runs erase_member as security definer) can act on the
-- flag, so setting it by hand gives an app user nothing. Updates and
-- truncates are refused as before.
--
-- All the work happens in this one function, so the Worker sends a single
-- query and does no per-row work itself.

create or replace function public.reject_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE'
     and coalesce(current_setting('app.erasing_member', true), '') <> ''
     and current_user not in ('anon', 'authenticated') then
    return old;
  end if;
  raise exception '% is append-only', tg_table_name using errcode = '42501';
end;
$$;

-- Owner only, inactive members only, and the caller must type the member's
-- code (IP-0042) to confirm. Returns nothing: the member no longer exists.
create function public.erase_member(target uuid, confirm_code text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  doomed public.members%rowtype;
  membership_ids uuid[];
  payment_ids uuid[];
  fee_ids uuid[];
  freeze_ids uuid[];
  visit_count integer;
begin
  if not public.has_role('owner') then
    raise exception 'Only the owner can delete a member permanently' using errcode = '42501';
  end if;

  select * into doomed from public.members where id = target for update;
  if not found then
    raise exception 'That member no longer exists' using errcode = 'P0002';
  end if;
  if doomed.is_active then
    raise exception 'Mark the member inactive before deleting them' using errcode = 'P0001';
  end if;
  if upper(btrim(coalesce(confirm_code, ''))) <> doomed.member_code then
    raise exception 'Type % exactly to confirm', doomed.member_code using errcode = 'P0001';
  end if;

  select coalesce(array_agg(id), '{}') into membership_ids
  from public.memberships where member_id = target;
  select coalesce(array_agg(id), '{}') into payment_ids
  from public.payments where member_id = target;
  select coalesce(array_agg(id), '{}') into fee_ids
  from public.membership_fees where membership_id = any (membership_ids);
  select coalesce(array_agg(id), '{}') into freeze_ids
  from public.membership_freezes where membership_id = any (membership_ids);

  -- A correction always belongs to the same member as the payment it
  -- replaces, but nothing in the schema forces that, so check rather than
  -- fail on a foreign key halfway through.
  if exists (
    select 1 from public.payments
    where replaces_payment_id = any (payment_ids) and member_id <> target
  ) then
    raise exception 'Another member''s payment corrects one of theirs, so they can''t be deleted' using errcode = 'P0001';
  end if;

  perform set_config('app.erasing_member', target::text, true);

  delete from public.claim_tokens where member_id = target;
  delete from public.notifications where member_id = target;
  delete from public.attendance where member_id = target;
  get diagnostics visit_count = row_count;
  delete from public.payment_voids where payment_id = any (payment_ids);
  delete from public.payments where member_id = target;
  delete from public.membership_fees where id = any (fee_ids);
  delete from public.membership_freezes where id = any (freeze_ids);
  delete from public.memberships where id = any (membership_ids);
  delete from public.members where id = target;

  -- The audit trail held copies of every row above, member id included.
  delete from public.audit_log
  where (table_name = 'members' and record_id = target::text)
     or (table_name = 'memberships' and record_id = any (membership_ids::text[]))
     or (table_name = 'membership_fees' and record_id = any (fee_ids::text[]))
     or (table_name = 'membership_freezes' and record_id = any (freeze_ids::text[]))
     or (table_name in ('payments', 'payment_voids') and record_id = any (payment_ids::text[]));

  perform set_config('app.erasing_member', '', true);

  -- A linked app account stays, but is no longer a member: it goes back to
  -- waiting as a guest. Staff accounts keep their role.
  if doomed.profile_id is not null then
    update public.profiles set role = 'guest'
    where id = doomed.profile_id and role = 'member';
  end if;

  -- Who erased someone, and when, stays on record. Nothing that identifies
  -- the member does.
  insert into public.audit_log (actor_id, table_name, record_id, action, before, after)
  values (
    auth.uid(), 'members', 'erased', 'delete', null,
    jsonb_build_object(
      'memberships', cardinality(membership_ids),
      'payments', cardinality(payment_ids),
      'visits', visit_count
    )
  );
end;
$$;

revoke all on function public.erase_member(uuid, text) from public, anon;
grant execute on function public.erase_member(uuid, text) to authenticated;
