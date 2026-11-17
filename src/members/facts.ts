import "server-only";
import { inArray, type SQL, type SQLWrapper } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { membershipFees, membershipFreezes } from "@/db/schema";
import type { UserTransaction } from "@/db/user-context";
import type { IsoDate } from "@/lib/dates";
import type { FeeChange, Freeze, MembershipFacts } from "@/members/billing";

export interface MembershipRow {
  id: string;
  memberId: string;
  startsOn: IsoDate;
  /** Null until the first payment; see memberships.billing_starts_on. */
  billingStartsOn: IsoDate | null;
  endedOn: IsoDate | null;
  planId: string | null;
}

/**
 * Which memberships' fees, freezes and payments to fetch, when the caller
 * already knows a cheaper way to say it than listing every id:
 * - "all": every membership the viewer can see (no filter at all);
 * - a subquery selecting membership ids (the same filter the rows came from).
 *
 * Left out, the rows' ids are sent as parameters, which is right for a few
 * memberships. For screens that list everyone it is not: building `in ($1,
 * …, $500)` cost about 1.6 ms of Worker CPU per query, before sending it.
 * A scope may match more memberships than the rows; extras are ignored.
 */
export type MembershipScope = "all" | SQLWrapper;

export function membershipFilter(
  column: AnyPgColumn,
  rows: MembershipRow[],
  scope?: MembershipScope,
): SQL | undefined {
  if (scope === "all") return undefined;
  if (scope) return inArray(column, scope);
  return inArray(
    column,
    rows.map((row) => row.id),
  );
}

/** Rows grouped by membership id, in their original order. */
function byMembership<T extends { membershipId: string }>(
  rows: T[],
): Map<string, T[]> {
  const grouped = new Map<string, T[]>();
  for (const row of rows) {
    const list = grouped.get(row.membershipId);
    if (list) list.push(row);
    else grouped.set(row.membershipId, [row]);
  }
  return grouped;
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
  scope?: MembershipScope,
): Promise<Map<string, MembershipFacts>> {
  const [feeRows, freezeRows] = rows.length
    ? await Promise.all([
        canSeeFees
          ? tx
              .select({
                membershipId: membershipFees.membershipId,
                feePaise: membershipFees.feePaise,
                effectiveFrom: membershipFees.effectiveFrom,
                createdAt: membershipFees.createdAt,
              })
              .from(membershipFees)
              .where(membershipFilter(membershipFees.membershipId, rows, scope))
          : Promise.resolve([]),
        tx
          .select({
            membershipId: membershipFreezes.membershipId,
            startsOn: membershipFreezes.startsOn,
            endsOn: membershipFreezes.endsOn,
          })
          .from(membershipFreezes)
          .where(membershipFilter(membershipFreezes.membershipId, rows, scope)),
      ])
    : [[], []];

  // One pass to group, not a scan of every fee and freeze per membership.
  const fees = byMembership(feeRows);
  const freezes = byMembership(freezeRows);
  const facts = new Map<string, MembershipFacts>();
  for (const row of rows) {
    facts.set(row.id, {
      startsOn: row.startsOn,
      billingStartsOn: row.billingStartsOn ?? row.startsOn,
      endedOn: row.endedOn,
      fees: canSeeFees
        ? (fees.get(row.id) ?? []).map<FeeChange>((fee) => ({
            feePaise: fee.feePaise,
            effectiveFrom: fee.effectiveFrom,
            createdAt: fee.createdAt,
          }))
        : null,
      freezes: (freezes.get(row.id) ?? []).map<Freeze>((freeze) => ({
        startsOn: freeze.startsOn,
        endsOn: freeze.endsOn,
      })),
    });
  }
  return facts;
}
