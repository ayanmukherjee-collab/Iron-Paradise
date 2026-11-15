import "server-only";
import { inArray } from "drizzle-orm";
import { membershipFees, membershipFreezes } from "@/db/schema";
import type { UserTransaction } from "@/db/user-context";
import type { IsoDate } from "@/lib/dates";
import type { FeeChange, Freeze, MembershipFacts } from "@/members/billing";

export interface MembershipRow {
  id: string;
  memberId: string;
  startsOn: IsoDate;
  endedOn: IsoDate | null;
  planId: string | null;
}

/**
 * Fees and freezes for each membership, keyed by membership id: the inputs
 * the billing and ledger rules need. Fees are left null when the viewer may
 * not see them (trainers), and RLS would hide them anyway.
 */
export async function loadFacts(
  tx: UserTransaction,
  rows: MembershipRow[],
  canSeeFees: boolean,
): Promise<Map<string, MembershipFacts>> {
  const ids = rows.map((row) => row.id);
  const [feeRows, freezeRows] = ids.length
    ? await Promise.all([
        canSeeFees
          ? tx
              .select()
              .from(membershipFees)
              .where(inArray(membershipFees.membershipId, ids))
          : Promise.resolve([]),
        tx
          .select()
          .from(membershipFreezes)
          .where(inArray(membershipFreezes.membershipId, ids)),
      ])
    : [[], []];

  const facts = new Map<string, MembershipFacts>();
  for (const row of rows) {
    facts.set(row.id, {
      startsOn: row.startsOn,
      endedOn: row.endedOn,
      fees: canSeeFees
        ? feeRows
            .filter((fee) => fee.membershipId === row.id)
            .map<FeeChange>((fee) => ({
              feePaise: fee.feePaise,
              effectiveFrom: fee.effectiveFrom,
              createdAt: fee.createdAt,
            }))
        : null,
      freezes: freezeRows
        .filter((freeze) => freeze.membershipId === row.id)
        .map<Freeze>((freeze) => ({
          startsOn: freeze.startsOn,
          endsOn: freeze.endsOn,
        })),
    });
  }
  return facts;
}
