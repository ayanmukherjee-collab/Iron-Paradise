// Browser versions of src/members/queries.ts: same names, same shapes.
import { visitWindowStart } from "@/attendance/visit-stats";
import { can } from "@/auth/permissions";
import type { Role } from "@/auth/permissions";
import { todayAtGym, type IsoDate } from "@/lib/dates";
import {
  activeFreeze,
  feeOn,
  isGoneQuiet,
  membershipStatus,
  nextDueDate,
  type MembershipStatus,
} from "@/members/billing";
import type { ClaimLinkState, MemberSummary } from "@/members/queries";
import { nextDueFromLedger } from "@/payments/ledger";
import type { Viewer } from "../auth/viewer";
import { dataOf } from "./action";
import { allRows, date, rpc, table } from "./db";
import {
  loadFacts,
  loadFactsAndLedgers,
  membershipColumns,
  type MembershipRow,
} from "./ledgers";

export type { ClaimLinkState, MemberSummary };

export async function getGoneQuietDays(): Promise<number> {
  const row = dataOf(
    await table("gym_settings").select("gone_quiet_days").maybeSingle(),
  ) as { gone_quiet_days: number } | null;
  return row?.gone_quiet_days ?? 30;
}

interface MemberListRow {
  id: string;
  memberCode: string;
  fullName: string;
  phone: string;
  isActive: boolean;
  profileId: string | null;
}

/** Every member with a status the viewer is allowed to see. */
export async function listMembers(viewer: Viewer): Promise<MemberSummary[]> {
  const canSeeFees = can(viewer.role, "payments.viewSheet");
  const today = todayAtGym();

  const [memberRows, openMemberships, activity, quietDays] = await Promise.all([
    allRows(() =>
      table("members")
        .select(
          "id, memberCode:member_code, fullName:full_name, phone, isActive:is_active, profileId:profile_id",
        )
        .order("full_name")
        .order("id"),
    ) as Promise<MemberListRow[]>,
    allRows(() =>
      table("memberships")
        .select(`${membershipColumns}, members!inner(is_active)`)
        .is("ended_on", null)
        .eq("members.is_active", true)
        .order("id"),
    ) as Promise<MembershipRow[]>,
    rpc<
      {
        member_id: string;
        last_visit: IsoDate | null;
        last_payment: IsoDate | null;
      }[]
    >("member_activity"),
    getGoneQuietDays(),
  ]);

  // Fees, freezes and payments for every membership the viewer can see;
  // the extra rows for ended memberships are ignored.
  const { facts, ledgers } = await loadFactsAndLedgers(
    openMemberships,
    canSeeFees,
    today,
    { scope: "all", coverage: false },
  );
  const membershipByMember = new Map(
    openMemberships.map((row) => [row.memberId, row]),
  );
  const lastVisit = new Map(activity.map((row) => [row.member_id, row]));

  return memberRows.map((member) => {
    const membership = membershipByMember.get(member.id);
    const fact = membership ? facts.get(membership.id)! : null;
    const status = membershipStatus(member.isActive, fact, today);
    const current = status !== "inactive" && fact;
    const ledger = current ? ledgers.get(membership!.id) : undefined;
    const seen = lastVisit.get(member.id);

    return {
      id: member.id,
      memberCode: member.memberCode,
      fullName: member.fullName,
      phone: member.phone,
      hasAccount: member.profileId !== null,
      status,
      feePaise: current && fact.fees ? feeOn(fact.fees, today) : null,
      nextDue:
        current && status !== "free"
          ? ledger
            ? nextDueFromLedger(ledger, today)
            : nextDueDate(fact, today)
          : null,
      goneQuiet:
        !!current &&
        status !== "frozen" &&
        isGoneQuiet({
          startsOn: fact.startsOn,
          lastVisit: seen?.last_visit ?? null,
          lastPayment: seen?.last_payment ?? null,
          today,
          days: quietDays,
        }),
      standing: ledger?.standing ?? null,
      owedPaise: ledger?.owedPaise ?? 0,
      lastVisit: seen?.last_visit ?? null,
    };
  });
}

export interface MemberRecord {
  id: string;
  memberCode: string;
  fullName: string;
  phone: string;
  isActive: boolean;
  profileId: string | null;
  reminderConsentAt: Date | null;
  remindersMuted: boolean;
  createdAt: Date;
}

export interface FreezeRow {
  id: string;
  membershipId: string;
  startsOn: IsoDate;
  endsOn: IsoDate | null;
  note: string | null;
  createdAt: Date;
}

export interface MemberDetail {
  member: MemberRecord;
  accountEmail: string | null;
  accountRole: Role | null;
  status: MembershipStatus;
  membership: {
    id: string;
    startsOn: IsoDate;
    planName: string | null;
    feePaise: number | null;
    nextDue: IsoDate | null;
    activeFreeze: ReturnType<typeof activeFreeze>;
    freezes: FreezeRow[];
    fees: {
      feePaise: number;
      effectiveFrom: IsoDate;
      note: string | null;
      createdAt: Date;
    }[];
  } | null;
  pastMemberships: (MembershipRow & { planName: string | null })[];
  visits: { gymDate: IsoDate; method: "qr" | "manual" }[];
  claimLink: { state: ClaimLinkState; expiresAt: Date | null };
}

/** One member with everything the detail page shows, or null. */
export async function getMemberDetail(
  viewer: Viewer,
  memberId: string,
): Promise<MemberDetail | null> {
  const canSeeFees = can(viewer.role, "payments.viewSheet");
  const canSeeClaims = can(viewer.role, "guests.link");
  const today = todayAtGym();

  const [found, history, visits, claim] = await Promise.all([
    table("members")
      .select(
        "id, memberCode:member_code, fullName:full_name, phone, isActive:is_active, profileId:profile_id, reminderConsentAt:reminder_consent_at, remindersMuted:reminders_muted, createdAt:created_at, profiles!members_profile_id_fkey(email, role)",
      )
      .eq("id", memberId)
      .maybeSingle()
      .then(dataOf),
    table("memberships")
      .select(`${membershipColumns}, plans(name)`)
      .eq("member_id", memberId)
      .order("starts_on", { ascending: false })
      .then(dataOf),
    table("attendance")
      .select("gymDate:gym_date, method")
      .eq("member_id", memberId)
      // Enough for the attendance charts: the last thirteen weeks.
      .gte("gym_date", visitWindowStart(today))
      .order("gym_date", { ascending: false })
      .then(dataOf),
    canSeeClaims
      ? table("claim_tokens")
          .select("used_at, revoked_at, expires_at")
          .eq("member_id", memberId)
          .order("created_at", { ascending: false })
          .limit(1)
          .then(dataOf)
      : Promise.resolve([]),
  ]);
  if (!found) return null;
  const raw = found as Record<string, unknown> & {
    profiles: { email: string | null; role: Role } | null;
  };
  const member: MemberRecord = {
    id: raw.id as string,
    memberCode: raw.memberCode as string,
    fullName: raw.fullName as string,
    phone: raw.phone as string,
    isActive: raw.isActive as boolean,
    profileId: raw.profileId as string | null,
    reminderConsentAt: date(raw.reminderConsentAt as string | null),
    remindersMuted: raw.remindersMuted as boolean,
    createdAt: date(raw.createdAt as string),
  };
  const rows = (
    history as (MembershipRow & { plans: { name: string } | null })[]
  ).map(({ plans, ...row }) => ({ ...row, planName: plans?.name ?? null }));

  const open = rows.find((row) => row.endedOn === null) ?? null;
  const [facts, freezeRows, feeRows] = await Promise.all([
    loadFacts(rows, canSeeFees),
    open
      ? table("membership_freezes")
          .select(
            "id, membershipId:membership_id, startsOn:starts_on, endsOn:ends_on, note, createdAt:created_at",
          )
          .eq("membership_id", open.id)
          .order("starts_on", { ascending: false })
          .then(dataOf)
      : Promise.resolve([]),
    open && canSeeFees
      ? table("membership_fees")
          .select(
            "feePaise:fee_paise, effectiveFrom:effective_from, note, createdAt:created_at",
          )
          .eq("membership_id", open.id)
          .order("effective_from", { ascending: false })
          .order("created_at", { ascending: false })
          .then(dataOf)
      : Promise.resolve([]),
  ]);
  const openFacts = open ? facts.get(open.id)! : null;
  const status = membershipStatus(member.isActive, openFacts, today);
  const token = (
    claim as {
      used_at: string | null;
      revoked_at: string | null;
      expires_at: string;
    }[]
  )[0];

  return {
    member,
    accountEmail: raw.profiles?.email ?? null,
    accountRole: raw.profiles?.role ?? null,
    status,
    membership:
      open && openFacts
        ? {
            id: open.id,
            startsOn: open.startsOn,
            planName: open.planName,
            feePaise: openFacts.fees ? feeOn(openFacts.fees, today) : null,
            nextDue: status === "free" ? null : nextDueDate(openFacts, today),
            activeFreeze: activeFreeze(openFacts.freezes, today),
            freezes: (
              freezeRows as (Omit<FreezeRow, "createdAt"> & {
                createdAt: string;
              })[]
            ).map((row) => ({ ...row, createdAt: date(row.createdAt) })),
            fees: (
              feeRows as {
                feePaise: number;
                effectiveFrom: IsoDate;
                note: string | null;
                createdAt: string;
              }[]
            ).map((row) => ({ ...row, createdAt: date(row.createdAt) })),
          }
        : null,
    pastMemberships: rows.filter((row) => row.endedOn !== null),
    visits: visits as MemberDetail["visits"],
    claimLink: claimLinkState(
      token
        ? {
            usedAt: date(token.used_at),
            revokedAt: date(token.revoked_at),
            expiresAt: date(token.expires_at),
          }
        : null,
    ),
  };
}

function claimLinkState(
  token: {
    usedAt: Date | null;
    revokedAt: Date | null;
    expiresAt: Date;
  } | null,
): { state: ClaimLinkState; expiresAt: Date | null } {
  if (!token) return { state: "none", expiresAt: null };
  if (token.usedAt) return { state: "used", expiresAt: null };
  if (token.revokedAt) return { state: "revoked", expiresAt: null };
  if (token.expiresAt <= new Date())
    return { state: "expired", expiresAt: token.expiresAt };
  return { state: "open", expiresAt: token.expiresAt };
}

export interface Plan {
  id: string;
  name: string;
  durationMonths: number;
  defaultFeePaise: number;
  isActive: boolean;
}

export async function listPlans(onlyActive = false): Promise<Plan[]> {
  let query = table("plans").select(
    "id, name, durationMonths:duration_months, defaultFeePaise:default_fee_paise, isActive:is_active",
  );
  if (onlyActive) query = query.eq("is_active", true);
  return dataOf(await query.order("duration_months").order("name")) as Plan[];
}

/** Signed-up accounts waiting to be linked to a member record. */
export async function listWaitingGuests(): Promise<
  { id: string; fullName: string; email: string | null; createdAt: Date }[]
> {
  const rows = dataOf(
    await table("profiles")
      .select("id, fullName:full_name, email, createdAt:created_at")
      .eq("role", "guest")
      .eq("is_active", true)
      .order("created_at", { ascending: false }),
  ) as {
    id: string;
    fullName: string;
    email: string | null;
    createdAt: string;
  }[];
  return rows.map((row) => ({ ...row, createdAt: date(row.createdAt) }));
}

/** Active members with no account yet: the ones a guest could be linked to. */
export async function listUnclaimedMembers(): Promise<
  { id: string; memberCode: string; fullName: string; phone: string }[]
> {
  return allRows(() =>
    table("members")
      .select("id, memberCode:member_code, fullName:full_name, phone")
      .eq("is_active", true)
      .is("profile_id", null)
      .order("full_name")
      .order("id"),
  );
}

export interface AuditEntry {
  id: number;
  occurredAt: Date;
  tableName: string;
  recordId: string | null;
  action: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  actorName: string | null;
  actorEmail: string | null;
}

export async function listAuditEntries(limit = 100): Promise<AuditEntry[]> {
  const rows = dataOf(
    await table("audit_log")
      .select(
        "id, occurredAt:occurred_at, tableName:table_name, recordId:record_id, action, before, after, actorId:actor_id",
      )
      .order("id", { ascending: false })
      .limit(limit),
  ) as (Omit<AuditEntry, "occurredAt" | "actorName" | "actorEmail"> & {
    occurredAt: string;
    actorId: string | null;
  })[];
  // audit_log has no foreign key to profiles (entries outlive accounts), so
  // the names come in a second small query.
  const actorIds = [
    ...new Set(rows.flatMap((row) => (row.actorId ? [row.actorId] : []))),
  ];
  const actors = actorIds.length
    ? (dataOf(
        await table("profiles")
          .select("id, full_name, email")
          .in("id", actorIds),
      ) as { id: string; full_name: string; email: string | null }[])
    : [];
  const byId = new Map(actors.map((actor) => [actor.id, actor]));
  return rows.map(({ occurredAt, actorId, ...row }) => {
    const actor = actorId ? byId.get(actorId) : undefined;
    return {
      ...row,
      occurredAt: date(occurredAt),
      actorName: actor?.full_name ?? null,
      actorEmail: actor?.email ?? null,
    };
  });
}

/** The signed-in person's own membership, for the member home screen. */
export async function getOwnMembership(viewer: Viewer) {
  const today = todayAtGym();
  const [member, open] = await Promise.all([
    table("members")
      .select(
        "id, memberCode:member_code, fullName:full_name, isActive:is_active, reminderConsentAt:reminder_consent_at, remindersMuted:reminders_muted",
      )
      .eq("profile_id", viewer.userId)
      .maybeSingle()
      .then(dataOf),
    table("memberships")
      .select(`${membershipColumns}, members!inner(profile_id)`)
      .eq("members.profile_id", viewer.userId)
      .is("ended_on", null)
      .maybeSingle()
      .then(dataOf),
  ]);
  if (!member) return null;
  const own = member as {
    id: string;
    memberCode: string;
    fullName: string;
    isActive: boolean;
    reminderConsentAt: string | null;
    remindersMuted: boolean;
  };
  const row = open as MembershipRow | null;
  const fact = row ? (await loadFacts([row], true)).get(row.id)! : null;
  const status = membershipStatus(own.isActive, fact, today);
  return {
    memberId: own.id,
    memberCode: own.memberCode,
    fullName: own.fullName,
    status,
    remindersAllowed: own.reminderConsentAt !== null && !own.remindersMuted,
    startsOn: fact?.startsOn ?? null,
    feePaise: fact?.fees ? feeOn(fact.fees, today) : null,
    nextDue: fact && status !== "free" ? nextDueDate(fact, today) : null,
  };
}
