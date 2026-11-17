import "server-only";
import { and, asc, eq, isNull } from "drizzle-orm";
import { members, memberships, profiles } from "@/db/schema";
import type { UserTransaction } from "@/db/user-context";
import type { IsoDate } from "@/lib/dates";
import { activeFreeze, feeOn } from "@/members/billing";
import type { Ledger } from "@/payments/ledger";
import { loadFactsAndLedgers } from "@/payments/queries";

export interface ReminderCandidate {
  memberId: string;
  memberCode: string;
  fullName: string;
  phone: string;
  /** The linked account, if any; reminders by push and email need one. */
  profileId: string | null;
  email: string | null;
  consented: boolean;
  muted: boolean;
  frozen: boolean;
  free: boolean;
  membershipId: string;
  ledger: Ledger;
}

/**
 * Every active member with an open membership, with what reminders need to
 * know about them. Shared by the daily job and the staff WhatsApp queue so
 * both apply the same rules.
 */
export async function loadReminderCandidates(
  tx: UserTransaction,
  today: IsoDate,
): Promise<ReminderCandidate[]> {
  const open = and(isNull(memberships.endedOn), eq(members.isActive, true));
  const rows = await tx
    .select({
      memberId: members.id,
      memberCode: members.memberCode,
      fullName: members.fullName,
      phone: members.phone,
      profileId: members.profileId,
      profileActive: profiles.isActive,
      email: profiles.email,
      consentAt: members.reminderConsentAt,
      muted: members.remindersMuted,
      membershipId: memberships.id,
      startsOn: memberships.startsOn,
      billingStartsOn: memberships.billingStartsOn,
      endedOn: memberships.endedOn,
      planId: memberships.planId,
    })
    .from(members)
    .innerJoin(memberships, eq(memberships.memberId, members.id))
    .leftJoin(profiles, eq(profiles.id, members.profileId))
    .where(open)
    .orderBy(asc(members.fullName));

  const { facts, ledgers } = await loadFactsAndLedgers(
    tx,
    rows.map((row) => ({
      id: row.membershipId,
      memberId: row.memberId,
      startsOn: row.startsOn,
      billingStartsOn: row.billingStartsOn,
      endedOn: row.endedOn,
      planId: row.planId,
    })),
    true,
    today,
    {
      // The same memberships, filtered in the database rather than sent back
      // as hundreds of id parameters; reminders need no per-payment detail.
      scope: tx
        .select({ id: memberships.id })
        .from(memberships)
        .innerJoin(members, eq(members.id, memberships.memberId))
        .where(open),
      coverage: false,
    },
  );

  return rows.flatMap((row) => {
    const fact = facts.get(row.membershipId);
    const ledger = ledgers.get(row.membershipId);
    if (!fact?.fees || !ledger) return [];
    const accountActive = row.profileId !== null && row.profileActive === true;
    return [
      {
        memberId: row.memberId,
        memberCode: row.memberCode,
        fullName: row.fullName,
        phone: row.phone,
        profileId: accountActive ? row.profileId : null,
        email: accountActive ? row.email : null,
        consented: row.consentAt !== null,
        muted: row.muted,
        frozen: activeFreeze(fact.freezes, today) !== null,
        free: feeOn(fact.fees, today) === 0,
        membershipId: row.membershipId,
        ledger,
      },
    ];
  });
}

/**
 * Brief §4.6: never remind free members, frozen memberships, members marked
 * inactive (already left out above), members who did not agree to
 * reminders, or members staff muted.
 */
export function mayRemind(candidate: ReminderCandidate): boolean {
  return (
    candidate.consented &&
    !candidate.muted &&
    !candidate.frozen &&
    !candidate.free
  );
}
