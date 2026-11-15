import "server-only";
import { and, asc, desc, eq, isNull, max } from "drizzle-orm";
import { can } from "@/auth/permissions";
import type { Viewer } from "@/auth/session";
import { getDb } from "@/db/client";
import {
  attendance,
  auditLog,
  claimTokens,
  gymSettings,
  members,
  membershipFees,
  membershipFreezes,
  memberships,
  paymentVoids,
  payments,
  plans,
  profiles,
} from "@/db/schema";
import { withUserContext, type UserTransaction } from "@/db/user-context";
import { todayAtGym, type IsoDate } from "@/lib/dates";
import {
  activeFreeze,
  feeOn,
  isGoneQuiet,
  membershipStatus,
  nextDueDate,
  type MembershipFacts,
  type MembershipStatus,
} from "@/members/billing";
import { loadFacts } from "@/members/facts";
import type { Standing } from "@/payments/ledger";
import { loadLedgers } from "@/payments/queries";

export interface MemberSummary {
  id: string;
  memberCode: string;
  fullName: string;
  phone: string;
  hasAccount: boolean;
  status: MembershipStatus;
  /** Null when hidden from this viewer (trainers) or there is no membership. */
  feePaise: number | null;
  nextDue: IsoDate | null;
  goneQuiet: boolean;
  /** Paid/due/overdue; null for inactive members or viewers without fees. */
  standing: Standing | null;
  owedPaise: number;
}

export async function getGoneQuietDays(viewer: Viewer): Promise<number> {
  const [row] = await withUserContext(getDb(), viewer.userId, (tx) =>
    tx.select({ days: gymSettings.goneQuietDays }).from(gymSettings),
  );
  return row?.days ?? 30;
}

/** Every member with a status the viewer is allowed to see. */
export async function listMembers(viewer: Viewer): Promise<MemberSummary[]> {
  const canSeeFees = can(viewer.role, "payments.viewSheet");
  const today = todayAtGym();

  return withUserContext(getDb(), viewer.userId, async (tx) => {
    const [memberRows, openMemberships, visits, paid, settings] =
      await Promise.all([
        tx.select().from(members).orderBy(asc(members.fullName)),
        tx
          .select({
            id: memberships.id,
            memberId: memberships.memberId,
            startsOn: memberships.startsOn,
            endedOn: memberships.endedOn,
            planId: memberships.planId,
          })
          .from(memberships)
          .where(isNull(memberships.endedOn)),
        tx
          .select({
            memberId: attendance.memberId,
            last: max(attendance.gymDate),
          })
          .from(attendance)
          .groupBy(attendance.memberId),
        tx
          // A voided payment was a mistake, not a sign the member is around.
          .select({ memberId: payments.memberId, last: max(payments.paidOn) })
          .from(payments)
          .leftJoin(paymentVoids, eq(paymentVoids.paymentId, payments.id))
          .where(isNull(paymentVoids.paymentId))
          .groupBy(payments.memberId),
        tx.select({ days: gymSettings.goneQuietDays }).from(gymSettings),
      ]);

    const facts = await loadFacts(tx, openMemberships, canSeeFees);
    const ledgers = await loadLedgers(tx, facts, today);
    const membershipByMember = new Map(
      openMemberships.map((row) => [row.memberId, row]),
    );
    const lastVisit = new Map(visits.map((row) => [row.memberId, row.last]));
    const lastPayment = new Map(paid.map((row) => [row.memberId, row.last]));
    const quietDays = settings[0]?.days ?? 30;

    return memberRows.map((member) => {
      const membership = membershipByMember.get(member.id);
      const fact = membership ? facts.get(membership.id)! : null;
      const status = membershipStatus(member.isActive, fact, today);
      const current = status !== "inactive" && fact;
      const ledger = current ? ledgers.get(membership!.id) : undefined;

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
            ? nextDueDate(fact.startsOn, fact.freezes, today)
            : null,
        goneQuiet:
          !!current &&
          status !== "frozen" &&
          isGoneQuiet({
            startsOn: fact.startsOn,
            lastVisit: lastVisit.get(member.id) ?? null,
            lastPayment: lastPayment.get(member.id) ?? null,
            today,
            days: quietDays,
          }),
        standing: ledger?.standing ?? null,
        owedPaise: ledger?.owedPaise ?? 0,
      };
    });
  });
}

export type ClaimLinkState = "none" | "open" | "used" | "expired" | "revoked";

export type MemberDetail = NonNullable<
  Awaited<ReturnType<typeof getMemberDetail>>
>;

/** One member with everything the detail page shows, or null if not visible. */
export async function getMemberDetail(viewer: Viewer, memberId: string) {
  const canSeeFees = can(viewer.role, "payments.viewSheet");
  const canSeeClaims = can(viewer.role, "guests.link");
  const today = todayAtGym();

  return withUserContext(getDb(), viewer.userId, async (tx) => {
    const [member] = await tx
      .select()
      .from(members)
      .where(eq(members.id, memberId));
    if (!member) return null;

    const [history, account, visits, claim] = await Promise.all([
      tx
        .select({
          id: memberships.id,
          memberId: memberships.memberId,
          startsOn: memberships.startsOn,
          endedOn: memberships.endedOn,
          planId: memberships.planId,
          planName: plans.name,
        })
        .from(memberships)
        .leftJoin(plans, eq(plans.id, memberships.planId))
        .where(eq(memberships.memberId, memberId))
        .orderBy(desc(memberships.startsOn)),
      member.profileId
        ? tx
            .select({ email: profiles.email })
            .from(profiles)
            .where(eq(profiles.id, member.profileId))
        : Promise.resolve([]),
      tx
        .select({ gymDate: attendance.gymDate, method: attendance.method })
        .from(attendance)
        .where(eq(attendance.memberId, memberId))
        .orderBy(desc(attendance.gymDate))
        .limit(30),
      canSeeClaims
        ? tx
            // Never select token_hash: staff have no access to it, by design.
            .select({
              usedAt: claimTokens.usedAt,
              revokedAt: claimTokens.revokedAt,
              expiresAt: claimTokens.expiresAt,
            })
            .from(claimTokens)
            .where(eq(claimTokens.memberId, memberId))
            .orderBy(desc(claimTokens.createdAt))
            .limit(1)
        : Promise.resolve([]),
    ]);

    const facts = await loadFacts(tx, history, canSeeFees);
    const open = history.find((row) => row.endedOn === null) ?? null;
    const openFacts = open ? facts.get(open.id)! : null;
    const status = membershipStatus(member.isActive, openFacts, today);
    const freezeRows = open
      ? await tx
          .select()
          .from(membershipFreezes)
          .where(eq(membershipFreezes.membershipId, open.id))
          .orderBy(desc(membershipFreezes.startsOn))
      : [];
    const feeRows =
      open && canSeeFees
        ? await tx
            .select({
              feePaise: membershipFees.feePaise,
              effectiveFrom: membershipFees.effectiveFrom,
              note: membershipFees.note,
              createdAt: membershipFees.createdAt,
            })
            .from(membershipFees)
            .where(eq(membershipFees.membershipId, open.id))
            .orderBy(
              desc(membershipFees.effectiveFrom),
              desc(membershipFees.createdAt),
            )
        : [];

    return {
      member,
      accountEmail: account[0]?.email ?? null,
      status,
      membership:
        open && openFacts
          ? {
              id: open.id,
              startsOn: open.startsOn,
              planName: open.planName,
              feePaise: openFacts.fees ? feeOn(openFacts.fees, today) : null,
              nextDue:
                status === "free"
                  ? null
                  : nextDueDate(open.startsOn, openFacts.freezes, today),
              activeFreeze: activeFreeze(openFacts.freezes, today),
              freezes: freezeRows,
              fees: feeRows,
            }
          : null,
      pastMemberships: history.filter((row) => row.endedOn !== null),
      visits,
      claimLink: claimLinkState(claim[0] ?? null),
    };
  });
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

/** Facts for one open membership, for actions that need the current rules. */
export async function getMembershipFacts(
  tx: UserTransaction,
  membershipId: string,
): Promise<MembershipFacts | null> {
  const [row] = await tx
    .select({
      id: memberships.id,
      memberId: memberships.memberId,
      startsOn: memberships.startsOn,
      endedOn: memberships.endedOn,
      planId: memberships.planId,
    })
    .from(memberships)
    .where(eq(memberships.id, membershipId));
  if (!row) return null;
  return (await loadFacts(tx, [row], true)).get(row.id) ?? null;
}

export async function listPlans(viewer: Viewer, onlyActive = false) {
  return withUserContext(getDb(), viewer.userId, (tx) =>
    tx
      .select()
      .from(plans)
      .where(onlyActive ? eq(plans.isActive, true) : undefined)
      .orderBy(asc(plans.durationMonths), asc(plans.name)),
  );
}

/** Signed-up accounts waiting to be linked to a member record. */
export async function listWaitingGuests(viewer: Viewer) {
  return withUserContext(getDb(), viewer.userId, (tx) =>
    tx
      .select({
        id: profiles.id,
        fullName: profiles.fullName,
        email: profiles.email,
        createdAt: profiles.createdAt,
      })
      .from(profiles)
      .where(and(eq(profiles.role, "guest"), eq(profiles.isActive, true)))
      .orderBy(desc(profiles.createdAt)),
  );
}

/** Active members with no account yet: the ones a guest could be linked to. */
export async function listUnclaimedMembers(viewer: Viewer) {
  return withUserContext(getDb(), viewer.userId, (tx) =>
    tx
      .select({
        id: members.id,
        memberCode: members.memberCode,
        fullName: members.fullName,
        phone: members.phone,
      })
      .from(members)
      .where(and(eq(members.isActive, true), isNull(members.profileId)))
      .orderBy(asc(members.fullName)),
  );
}

export async function listAuditEntries(viewer: Viewer, limit = 100) {
  return withUserContext(getDb(), viewer.userId, (tx) =>
    tx
      .select({
        id: auditLog.id,
        occurredAt: auditLog.occurredAt,
        tableName: auditLog.tableName,
        recordId: auditLog.recordId,
        action: auditLog.action,
        before: auditLog.before,
        after: auditLog.after,
        actorName: profiles.fullName,
        actorEmail: profiles.email,
      })
      .from(auditLog)
      .leftJoin(profiles, eq(profiles.id, auditLog.actorId))
      .orderBy(desc(auditLog.id))
      .limit(limit),
  );
}

/** The signed-in person's own membership, for the member home screen. */
export async function getOwnMembership(viewer: Viewer) {
  const today = todayAtGym();
  return withUserContext(getDb(), viewer.userId, async (tx) => {
    const [member] = await tx
      .select()
      .from(members)
      .where(eq(members.profileId, viewer.userId));
    if (!member) return null;
    const [open] = await tx
      .select({
        id: memberships.id,
        memberId: memberships.memberId,
        startsOn: memberships.startsOn,
        endedOn: memberships.endedOn,
        planId: memberships.planId,
      })
      .from(memberships)
      .where(
        and(eq(memberships.memberId, member.id), isNull(memberships.endedOn)),
      );
    const fact = open
      ? (await loadFacts(tx, [open], true)).get(open.id)!
      : null;
    const status = membershipStatus(member.isActive, fact, today);
    return {
      memberId: member.id,
      memberCode: member.memberCode,
      fullName: member.fullName,
      status,
      startsOn: fact?.startsOn ?? null,
      feePaise: fact?.fees ? feeOn(fact.fees, today) : null,
      nextDue:
        fact && status !== "free"
          ? nextDueDate(fact.startsOn, fact.freezes, today)
          : null,
    };
  });
}
