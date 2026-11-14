-- Claim links connect a signed-in Google account to a staff-created member.
-- Only a SHA-256 hash of the token is stored. Tokens are single-use, expire
-- after 48 hours, and issuing a new one revokes any live one for that member.
-- The table has no direct write access; both operations go through the
-- checked functions below.

create table public.claim_tokens (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members (id),
  token_hash bytea not null unique,
  expires_at timestamptz not null default now() + interval '48 hours',
  used_at timestamptz,
  used_by uuid references public.profiles (id),
  revoked_at timestamptz,
  created_by uuid references public.profiles (id) default auth.uid(),
  created_at timestamptz not null default now()
);
alter table public.claim_tokens enable row level security;
revoke all on table public.claim_tokens from anon, authenticated;

create unique index claim_tokens_one_live_per_member
  on public.claim_tokens (member_id)
  where used_at is null and revoked_at is null;

create policy "claim_tokens: owner and manager read"
  on public.claim_tokens for select to authenticated
  using (public.has_role('owner', 'manager'));

grant select (id, member_id, expires_at, used_at, used_by, revoked_at, created_by, created_at)
  on table public.claim_tokens to authenticated;

create function public.hash_claim_token(raw_token text)
returns bytea
language sql
immutable
set search_path = ''
as $$
  select sha256(convert_to(raw_token, 'UTF8'));
$$;

create function public.issue_claim_token(target_member uuid, raw_token text)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  expiry timestamptz;
begin
  if not public.has_role('owner', 'manager') then
    raise exception 'Only the owner or a manager can create claim links' using errcode = '42501';
  end if;
  if length(raw_token) < 32 then
    raise exception 'Claim token is too short' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.members where id = target_member and is_active and profile_id is null
  ) then
    raise exception 'Member is inactive or already linked to an account' using errcode = 'P0002';
  end if;

  update public.claim_tokens set revoked_at = now()
  where member_id = target_member and used_at is null and revoked_at is null;

  insert into public.claim_tokens (member_id, token_hash, created_by)
  values (target_member, public.hash_claim_token(raw_token), auth.uid())
  returning expires_at into expiry;

  return expiry;
end;
$$;

create function public.redeem_claim_token(raw_token text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  caller_role public.app_role := public.current_app_role();
  claim public.claim_tokens%rowtype;
begin
  if caller is null or caller_role is null then
    raise exception 'Sign in to claim your membership' using errcode = '42501';
  end if;

  select * into claim from public.claim_tokens
  where token_hash = public.hash_claim_token(raw_token)
  for update;

  -- One message for every bad-token case so a caller cannot probe which
  -- tokens exist.
  if not found or claim.used_at is not null or claim.revoked_at is not null
     or claim.expires_at <= now() then
    raise exception 'This link has expired or was already used' using errcode = 'P0001';
  end if;

  if exists (select 1 from public.members where profile_id = caller) then
    raise exception 'Your account is already linked to a membership' using errcode = 'P0001';
  end if;

  update public.claim_tokens set used_at = now(), used_by = caller where id = claim.id;

  update public.members set profile_id = caller
  where id = claim.member_id and is_active and profile_id is null;
  if not found then
    raise exception 'This link has expired or was already used' using errcode = 'P0001';
  end if;

  if caller_role = 'guest' then
    update public.profiles set role = 'member' where id = caller;
  end if;

  return claim.member_id;
end;
$$;

grant execute on function public.issue_claim_token(uuid, text) to authenticated;
grant execute on function public.redeem_claim_token(text) to authenticated;
