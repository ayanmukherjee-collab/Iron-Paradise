// The yearly close (supabase/migrations/*_year_close.sql): which payments go
// and what replaces them. Pure, so the money rule can be tested exhaustively.
//
// A membership's balance comes from every payment since it began, so old
// payments can only go if something carries their money forward without
// changing a single month. One carried-forward entry starting at the oldest
// payment's first period does that whenever the old payments filled their
// months in an unbroken run, which is nearly always. Each candidate is
// checked by building the ledger both ways; if anything differs (someone
// once paid a later month and left an earlier one short, say), the entries
// are kept one per first period instead. Payments with the same first
// period always add up to the same ledger (see countedTotals), so that
// fallback is exact.
import type { IsoDate } from "@/lib/dates";
import {
  buildLedger,
  type Ledger,
  type LedgerPayment,
  type MembershipWithFees,
} from "@/payments/ledger";

/** The financial year starts on 1 April. */
const yearStartMonth = 4;

/**
 * Everything before this day is summed up and deleted. It is the start of
 * the previous financial year, so at least twelve months (and up to two
 * years) of detail always remain: run on 1 April 2028, it is 1 April 2027.
 */
export function yearCloseCutoff(today: IsoDate): IsoDate {
  const year = Number(today.slice(0, 4));
  const month = Number(today.slice(5, 7));
  const thisYearStart = month >= yearStartMonth ? year : year - 1;
  return `${thisYearStart - 1}-0${yearStartMonth}-01`;
}

/** The next close after `today`, and the cut-off it will use. */
export function nextYearClose(today: IsoDate): {
  on: IsoDate;
  cutoff: IsoDate;
} {
  const year = Number(today.slice(0, 4));
  const month = Number(today.slice(5, 7));
  const nextYear = month >= yearStartMonth ? year + 1 : year;
  const on = `${nextYear}-0${yearStartMonth}-01`;
  return { on, cutoff: yearCloseCutoff(on) };
}

export interface ClosePayment {
  id: string;
  membershipId: string;
  firstPeriod: number;
  amountPaise: number;
  paidOn: IsoDate;
  createdAt: Date;
  voided: boolean;
  replacesPaymentId: string | null;
}

export interface CarryPlan {
  membershipId: string;
  /** Every payment (counted or voided) the close deletes. */
  deleteIds: string[];
  /** What replaces the counted ones; empty when all of them were voided. */
  carry: { firstPeriod: number; amountPaise: number }[];
}

/**
 * The plan for every membership with payments dated before `cutoff`.
 * `memberships` must hold every membership those payments belong to, with
 * fees; one without (it shouldn't happen) is kept one entry per period.
 */
export function planCarries(
  memberships: Map<string, MembershipWithFees>,
  payments: ClosePayment[],
  cutoff: IsoDate,
  today: IsoDate,
): CarryPlan[] {
  const byMembership = new Map<string, ClosePayment[]>();
  for (const payment of payments) {
    const list = byMembership.get(payment.membershipId);
    if (list) list.push(payment);
    else byMembership.set(payment.membershipId, [payment]);
  }

  const plans: CarryPlan[] = [];
  for (const [membershipId, all] of byMembership) {
    const old = all.filter((payment) => payment.paidOn < cutoff);
    if (old.length === 0) continue;

    // A correction that stays points at the payment it replaced; that one
    // (always voided) stays too, and so on down the chain, so every link
    // holds.
    const byId = new Map(all.map((payment) => [payment.id, payment]));
    const staying = new Set(
      all.filter((payment) => payment.paidOn >= cutoff).map((p) => p.id),
    );
    for (const id of [...staying]) {
      let replaced = byId.get(id)?.replacesPaymentId ?? null;
      while (replaced && !staying.has(replaced)) {
        staying.add(replaced);
        replaced = byId.get(replaced)?.replacesPaymentId ?? null;
      }
    }
    const leaving = old.filter((payment) => !staying.has(payment.id));
    if (leaving.length === 0) continue;
    const leavingIds = new Set(leaving.map((payment) => payment.id));
    const counted = all.filter((payment) => !payment.voided);
    const countedLeaving = counted.filter((p) => leavingIds.has(p.id));
    const countedStaying = counted.filter((p) => !leavingIds.has(p.id));

    plans.push({
      membershipId,
      deleteIds: leaving.map((payment) => payment.id),
      carry: countedLeaving.length
        ? chooseCarry(
            memberships.get(membershipId),
            countedLeaving,
            countedStaying,
            today,
          )
        : [],
    });
  }
  return plans;
}

function chooseCarry(
  membership: MembershipWithFees | undefined,
  leaving: ClosePayment[],
  staying: ClosePayment[],
  today: IsoDate,
): CarryPlan["carry"] {
  const perPeriod = new Map<number, number>();
  for (const payment of leaving) {
    perPeriod.set(
      payment.firstPeriod,
      (perPeriod.get(payment.firstPeriod) ?? 0) + payment.amountPaise,
    );
  }
  const grouped = [...perPeriod]
    .sort(([a], [b]) => a - b)
    .map(([firstPeriod, amountPaise]) => ({ firstPeriod, amountPaise }));
  if (grouped.length === 1 || !membership) return grouped;

  const single = [
    {
      firstPeriod: grouped[0].firstPeriod,
      amountPaise: grouped.reduce((sum, entry) => sum + entry.amountPaise, 0),
    },
  ];
  const earliest = new Date(
    Math.min(...leaving.map((payment) => payment.createdAt.getTime())),
  );
  const asLedger = (entries: CarryPlan["carry"]): LedgerPayment[] => [
    ...entries.map((entry, i) => ({
      id: `carried-${i}`,
      firstPeriod: entry.firstPeriod,
      amountPaise: entry.amountPaise,
      createdAt: earliest,
    })),
    ...staying.map(toLedgerPayment),
  ];

  const before = buildLedger(
    membership,
    [...leaving, ...staying].map(toLedgerPayment),
    today,
  );
  const after = buildLedger(membership, asLedger(single), today);
  return sameLedger(before, after) ? single : grouped;
}

function toLedgerPayment(payment: ClosePayment): LedgerPayment {
  return {
    id: payment.id,
    firstPeriod: payment.firstPeriod,
    amountPaise: payment.amountPaise,
    createdAt: payment.createdAt,
  };
}

/** Same months, same money in each, same balance: coverage aside. */
export function sameLedger(a: Ledger, b: Ledger): boolean {
  if (
    a.owedPaise !== b.owedPaise ||
    a.creditPaise !== b.creditPaise ||
    a.standing !== b.standing ||
    a.periods.length !== b.periods.length
  ) {
    return false;
  }
  return a.periods.every((period, i) => {
    const other = b.periods[i];
    return (
      period.index === other.index &&
      period.dueOn === other.dueOn &&
      period.feePaise === other.feePaise &&
      period.paidPaise === other.paidPaise &&
      period.status === other.status
    );
  });
}
