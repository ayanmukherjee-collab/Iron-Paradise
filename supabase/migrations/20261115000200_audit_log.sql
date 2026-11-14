-- Append-only audit trail of membership, role and payment changes.
-- Rows are written only by the audit trigger. A guard trigger rejects every
-- update, delete and truncate, so not even the owner or a service connection
-- can rewrite history.

create table public.audit_log (
  id bigint generated always as identity primary key,
  occurred_at timestamptz not null default now(),
  -- No foreign key: history must outlive the account that made the change.
  actor_id uuid,
  table_name text not null,
  record_id text not null,
  action text not null check (action in ('insert', 'update', 'delete')),
  before jsonb,
  after jsonb
);
alter table public.audit_log enable row level security;
revoke all on table public.audit_log from anon, authenticated;

create policy "audit_log: owner and manager read"
  on public.audit_log for select to authenticated
  using (public.has_role('owner', 'manager'));

grant select on table public.audit_log to authenticated;

create function public.reject_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception '% is append-only', tg_table_name using errcode = '42501';
end;
$$;

create trigger audit_log_append_only
  before update or delete on public.audit_log
  for each row execute function public.reject_change();

create trigger audit_log_no_truncate
  before truncate on public.audit_log
  for each statement execute function public.reject_change();

create function public.write_audit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  old_row jsonb := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end;
  new_row jsonb := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end;
begin
  insert into public.audit_log (actor_id, table_name, record_id, action, before, after)
  values (
    auth.uid(),
    tg_table_name,
    coalesce(new_row ->> 'id', old_row ->> 'id', new_row ->> 'payment_id', old_row ->> 'payment_id'),
    lower(tg_op),
    old_row,
    new_row
  );
  return coalesce(new, old);
end;
$$;

-- Profiles are audited only when access changes, not on name edits.
create trigger profiles_audit_access
  after update on public.profiles
  for each row
  when (old.role is distinct from new.role or old.is_active is distinct from new.is_active)
  execute function public.write_audit();
