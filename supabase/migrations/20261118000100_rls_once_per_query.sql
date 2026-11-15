-- Faster row-level security, same rules.
--
-- A bare function call in a policy, such as `using (public.is_staff())`, is
-- run again for every row the query looks at, and each run does its own
-- profiles lookup. Wrapped as `(select public.is_staff())`, Postgres runs it
-- once per query and reuses the answer (an "initPlan"). Supabase recommends
-- this for every policy; it matters more as members and payments pile up.
--
-- "Read own" policies asked "is this row's member mine?" row by row. They now
-- compare against the caller's own member id, worked out once per query.
-- Who can see what does not change; src/db/*-rls.test.ts prove it.

-- The caller's member id, or null when they have none or are switched off.
create function public.own_member_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.id from public.members m
  where m.profile_id = auth.uid() and public.current_app_role() is not null;
$$;
grant execute on function public.own_member_id() to authenticated;

-- Every membership (open or ended) of the caller's member record.
create function public.own_membership_ids()
returns uuid[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(ms.id), '{}')
  from public.memberships ms
  where ms.member_id = public.own_member_id();
$$;
grant execute on function public.own_membership_ids() to authenticated;

-- profiles
alter policy "profiles: read own" on public.profiles
  using (id = (select auth.uid()));
alter policy "profiles: owner and manager read all" on public.profiles
  using ((select public.has_role('owner', 'manager')));
alter policy "profiles: update own" on public.profiles
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- audit_log
alter policy "audit_log: owner and manager read" on public.audit_log
  using ((select public.has_role('owner', 'manager')));

-- members
alter policy "members: staff read" on public.members
  using ((select public.is_staff()));
alter policy "members: read own" on public.members
  using (
    profile_id = (select auth.uid())
    and (select public.current_app_role()) is not null
  );
alter policy "members: owner and manager edit" on public.members
  using ((select public.has_role('owner', 'manager')))
  with check ((select public.has_role('owner', 'manager')));

-- plans
alter policy "plans: signed-in members and staff read" on public.plans
  using ((select public.has_role('owner', 'manager', 'trainer', 'member')));

-- memberships
alter policy "memberships: staff read" on public.memberships
  using ((select public.is_staff()));
alter policy "memberships: read own" on public.memberships
  using (member_id = (select public.own_member_id()));
alter policy "memberships: owner and manager edit" on public.memberships
  using ((select public.has_role('owner', 'manager')))
  with check ((select public.has_role('owner', 'manager')));

-- payments
alter policy "payments: owner and manager read" on public.payments
  using ((select public.has_role('owner', 'manager')));
alter policy "payments: read own" on public.payments
  using (member_id = (select public.own_member_id()));

-- payment_voids
alter policy "payment_voids: owner and manager read" on public.payment_voids
  using ((select public.has_role('owner', 'manager')));
alter policy "payment_voids: read own" on public.payment_voids
  using (
    exists (
      select 1 from public.payments p
      where p.id = payment_id and p.member_id = (select public.own_member_id())
    )
  );

-- attendance
alter policy "attendance: staff read" on public.attendance
  using ((select public.is_staff()));
alter policy "attendance: read own" on public.attendance
  using (member_id = (select public.own_member_id()));

-- claim_tokens
alter policy "claim_tokens: owner and manager read" on public.claim_tokens
  using ((select public.has_role('owner', 'manager')));

-- membership_fees
alter policy "membership_fees: owner and manager read" on public.membership_fees
  using ((select public.has_role('owner', 'manager')));
alter policy "membership_fees: read own" on public.membership_fees
  using (membership_id = any ((select public.own_membership_ids())::uuid[]));

-- membership_freezes
alter policy "membership_freezes: staff read" on public.membership_freezes
  using ((select public.is_staff()));
alter policy "membership_freezes: read own" on public.membership_freezes
  using (membership_id = any ((select public.own_membership_ids())::uuid[]));
alter policy "membership_freezes: owner and manager end" on public.membership_freezes
  using ((select public.has_role('owner', 'manager')))
  with check ((select public.has_role('owner', 'manager')));

-- gym_settings
alter policy "gym_settings: staff read" on public.gym_settings
  using ((select public.is_staff()));

-- Indexes for lookups the app makes on every member page and list.
create index attendance_member_date_idx
  on public.attendance (member_id, gym_date desc);
create index claim_tokens_member_created_idx
  on public.claim_tokens (member_id, created_at desc);
