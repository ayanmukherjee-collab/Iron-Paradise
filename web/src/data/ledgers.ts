// Browser versions of loadFacts / loadFactsAndLedgers (src/members/facts.ts,
// src/payments/queries.ts): the same rows, fetched through the Data API, fed
// to the same pure billing and ledger code.
import type { DueChangeRow } from "@/db/schema";
import type { IsoDate } from "@/lib/dates";
import type { FeeChange, Freeze, MembershipFacts } from "@/members/billing";
import type { MembershipRow } from "@/members/facts";
import {
  buildLedger,
  type Ledger,
  type LedgerPayment,
  type MembershipWithFees,
} from "@/payments/ledger";
import { allRows, date, groupBy, rpc, table } from "./db";

export type { MembershipRow };

/** Select list giving MembershipRow's camelCase fields. */
export const membershipColumns =
  "id, memberId:member_id, startsOn:starts_on, billingStartsOn:billing_starts_on, dueChanges:due_changes, endedOn:ended_on, planId:plan_id";

/**
 * Which memberships' fees, freezes and payments to fetch: "all" (every one
 * the viewer may see, one paged query each) or just these rows' ids.
 */
export type Scope = "all" | "rows";

function scoped<
  Q extends { in(column: string, values: string[]): Q; order(c: string): Q },
>(query: Q, rows: MembershipRow[], scope: Scope): Q {
  const ordered = query.order("id");
  return scope === "all"
    ? ordered
    : ordered.in(
        "membership_id",
        rows.map((row) => row.id),
      );
}

export async function loadFacts(
  rows: MembershipRow[],
  canSeeFees: boolean,
  scope: Scope = "rows",
): Promise<Map<string, MembershipFacts>> {
  const [feeRows, freezeRows] = rows.length
    ? await Promise.all([
        canSeeFees
          ? allRows(() =>
              scoped(
                table("membership_fees").select(
                  "membershipId:membership_id, feePaise:fee_paise, effectiveFrom:effective_from, createdAt:created_at",
                ),
                rows,
                scope,
              ),
            )
          : Promise.resolve([]),
        allRows(() =>
          scoped(
            table("membership_freezes").select(
              "membershipId:membership_id, startsOn:starts_on, endsOn:ends_on",
            ),
            rows,
            scope,
          ),
        ),
      ])
    : [[], []];

  const fees = groupBy(
    feeRows as {
      membershipId: string;
      feePaise: number;
      effectiveFrom: IsoDate;
      createdAt: string;
    }[],
    (row) => row.membershipId,
  );
  const freezes = groupBy(
    freezeRows as {
      membershipId: string;
      startsOn: IsoDate;
      endsOn: IsoDate | null;
    }[],
    (row) => row.membershipId,
  );
  const facts = new Map<string, MembershipFacts>();
  for (const row of rows) {
    facts.set(row.id, {
      startsOn: row.startsOn,
      billingStartsOn: row.billingStartsOn ?? row.startsOn,
      dueChanges: (row.dueChanges as DueChangeRow[]).map((change) => ({
        fromPeriod: change.from_period,
        dueOn: change.due_on,
      })),
      endedOn: row.endedOn,
      fees: canSeeFees
        ? (fees.get(row.id) ?? []).map<FeeChange>((fee) => ({
            feePaise: fee.feePaise,
            effectiveFrom: fee.effectiveFrom,
            createdAt: date(fee.createdAt),
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

/** Every counted (not voided) payment of these memberships. */
export async function countedPayments(
  rows: MembershipRow[],
): Promise<Map<string, LedgerPayment[]>> {
  if (!rows.length) return new Map();
  const found = await allRows(() =>
    table("payments")
      .select(
        "id, membershipId:membership_id, firstPeriod:first_period, amountPaise:amount_paise, createdAt:created_at, payment_voids(payment_id)",
      )
      .in(
        "membership_id",
        rows.map((row) => row.id),
      )
      .order("id"),
  );
  const counted = (
    found as {
      id: string;
      membershipId: string;
      firstPeriod: number;
      amountPaise: number;
      createdAt: string;
      payment_voids: unknown;
    }[]
  ).filter((row) => !hasRow(row.payment_voids));
  const byMembership = new Map<string, LedgerPayment[]>();
  for (const row of counted) {
    const payment: LedgerPayment = {
      id: row.id,
      firstPeriod: row.firstPeriod,
      amountPaise: row.amountPaise,
      createdAt: date(row.createdAt),
    };
    const list = byMembership.get(row.membershipId);
    if (list) list.push(payment);
    else byMembership.set(row.membershipId, [payment]);
  }
  return byMembership;
}

const totalRecordedAt = new Date(0);

/**
 * Counted payments summed per membership and first period, in the database
 * (see countedTotals in src/payments/queries.ts for why this gives the same
 * ledgers, coverage aside).
 */
export async function countedTotals(): Promise<Map<string, LedgerPayment[]>> {
  const found = await rpc<
    { membership_id: string; first_period: number; amount_paise: number }[]
  >("counted_payment_totals");
  const byMembership = new Map<string, LedgerPayment[]>();
  for (const row of found) {
    const total: LedgerPayment = {
      id: `from-period-${row.first_period}`,
      firstPeriod: row.first_period,
      amountPaise: Number(row.amount_paise),
      createdAt: totalRecordedAt,
    };
    const list = byMembership.get(row.membership_id);
    if (list) list.push(total);
    else byMembership.set(row.membership_id, [total]);
  }
  return byMembership;
}

export function withFees(facts: MembershipFacts): MembershipWithFees | null {
  return facts.fees ? { ...facts, fees: facts.fees } : null;
}

export async function loadFactsAndLedgers(
  rows: MembershipRow[],
  canSeeFees: boolean,
  today: IsoDate,
  {
    scope = "rows",
    coverage = true,
  }: { scope?: Scope; coverage?: boolean } = {},
): Promise<{
  facts: Map<string, MembershipFacts>;
  ledgers: Map<string, Ledger>;
}> {
  const [facts, paid] = await Promise.all([
    loadFacts(rows, canSeeFees, scope),
    !canSeeFees || !rows.length
      ? new Map<string, LedgerPayment[]>()
      : coverage
        ? countedPayments(rows)
        : countedTotals(),
  ]);
  const ledgers = new Map<string, Ledger>();
  for (const [id, fact] of facts) {
    const membership = withFees(fact);
    if (membership)
      ledgers.set(id, buildLedger(membership, paid.get(id) ?? [], today));
  }
  return { facts, ledgers };
}

/** One membership's row, or null. */
export async function membershipRow(
  membershipId: string,
): Promise<MembershipRow | null> {
  const { data, error } = await table("memberships")
    .select(membershipColumns)
    .eq("id", membershipId)
    .maybeSingle();
  if (error) throw error;
  return data as MembershipRow | null;
}

/** An embedded one-to-one row comes back as an object, null, or a list. */
export function hasRow(value: unknown): boolean {
  return Array.isArray(value) ? value.length > 0 : value != null;
}
