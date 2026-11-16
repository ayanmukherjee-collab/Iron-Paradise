-- Phase 5: due reminders (brief §4.6).
--
-- A daily job reminds members whose fee is due in 3 days, due today, or 3
-- days overdue, by push notification and email. Staff send WhatsApp messages
-- themselves from a queue. Every message is logged in `notifications`, and a
-- unique key there is what guarantees the same reminder is never sent twice:
-- the job claims a row before it sends, and a second claim finds it taken.

create type public.reminder_stage as enum ('due_soon', 'due_today', 'overdue');
create type public.notification_channel as enum ('push', 'email', 'whatsapp');
-- 'sending' is held only while the job is talking to the channel. Staff-sent
-- WhatsApp rows start as 'sent': the app can't see what happens in WhatsApp.
create type public.notification_status as enum ('sending', 'sent', 'failed');

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members (id),
  membership_id uuid not null,
  -- The fee period being reminded about (see payments.first_period).
  period smallint not null check (period between 0 and 599),
  stage public.reminder_stage not null,
  channel public.notification_channel not null,
  status public.notification_status not null default 'sending',
  due_on date not null,
  -- What the message said was owed.
  amount_paise integer not null check (amount_paise > 0),
  error text check (length(error) <= 300),
  -- Null when the daily job sent it.
  sent_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  finished_at timestamptz,
  foreign key (membership_id, member_id) references public.memberships (id, member_id),
  constraint notifications_once unique (membership_id, period, stage, channel)
);
alter table public.notifications enable row level security;
revoke all on table public.notifications from anon, authenticated;

create index notifications_recent_idx on public.notifications (created_at desc);

create trigger notifications_stamp_created_at
  before insert on public.notifications
  for each row execute function public.stamp_server_time('created_at');

create trigger notifications_never_deleted
  before delete on public.notifications
  for each row execute function public.reject_change();

create trigger notifications_no_truncate
  before truncate on public.notifications
  for each statement execute function public.reject_change();

-- The log is append-only apart from one step: the job settles its own
-- 'sending' row as sent or failed, once.
create function public.settle_notification_once()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status <> 'sending'
    or new.status = 'sending'
    or (new.id, new.member_id, new.membership_id, new.period, new.stage,
        new.channel, new.due_on, new.amount_paise, new.sent_by, new.created_at)
       is distinct from
       (old.id, old.member_id, old.membership_id, old.period, old.stage,
        old.channel, old.due_on, old.amount_paise, old.sent_by, old.created_at)
  then
    raise exception 'notifications is append-only' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger notifications_settle_once
  before update on public.notifications
  for each row execute function public.settle_notification_once();

create policy "notifications: owner and manager read"
  on public.notifications for select to authenticated
  using ((select public.has_role('owner', 'manager')));

-- Staff log a WhatsApp message they sent. Push and email rows are written by
-- the daily job, which runs on the server's own connection.
create policy "notifications: owner and manager log whatsapp"
  on public.notifications for insert to authenticated
  with check (
    (select public.has_role('owner', 'manager'))
    and channel = 'whatsapp'
    and status = 'sent'
    and error is null
    and sent_by = (select auth.uid())
  );

-- Whole-row insert (the ORM names every column); the policy above limits
-- what a row may say, and created_at is stamped by the server.
grant select on table public.notifications to authenticated;
grant insert on table public.notifications to authenticated;

-- One row per browser that agreed to push notifications. The keys are the
-- browser's public encryption key and auth secret (RFC 8291); they let the
-- server encrypt messages to that browser and nothing else.
create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  endpoint text not null unique
    check (endpoint like 'https://%' and length(endpoint) <= 1000),
  p256dh text not null check (p256dh ~ '^[A-Za-z0-9_-]{86,88}$'),
  auth text not null check (auth ~ '^[A-Za-z0-9_-]{22,24}$'),
  created_at timestamptz not null default now()
);
alter table public.push_subscriptions enable row level security;
revoke all on table public.push_subscriptions from anon, authenticated;

create index push_subscriptions_profile_idx on public.push_subscriptions (profile_id);

create policy "push_subscriptions: read own"
  on public.push_subscriptions for select to authenticated
  using (profile_id = (select auth.uid()));

create policy "push_subscriptions: remove own"
  on public.push_subscriptions for delete to authenticated
  using (profile_id = (select auth.uid()));

grant select (id, endpoint, created_at) on table public.push_subscriptions to authenticated;
grant delete on table public.push_subscriptions to authenticated;

-- Saves this browser's subscription for the caller. A browser has one
-- endpoint, so when someone else signs in on the same phone the endpoint
-- moves to them; the previous person stops getting notifications there.
-- That row belongs to someone else, which RLS would hide, hence definer.
create function public.save_push_subscription(
  sub_endpoint text,
  sub_p256dh text,
  sub_auth text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.has_role('owner', 'manager', 'trainer', 'member') then
    raise exception 'Only gym members can turn on reminders' using errcode = '42501';
  end if;
  delete from public.push_subscriptions where endpoint = sub_endpoint;
  insert into public.push_subscriptions (profile_id, endpoint, p256dh, auth)
  values (auth.uid(), sub_endpoint, sub_p256dh, sub_auth);
end;
$$;
grant execute on function public.save_push_subscription(text, text, text) to authenticated;

-- Members agree to reminders when they register (brief §4.6). Staff can now
-- record or withdraw that agreement later too, for members added before
-- they were asked.
grant update (reminder_consent_at) on table public.members to authenticated;
