// What each member owes, worked out from the ledger every time (brief §4.4,
// §4.5). Pure functions over plain data, like members/billing.ts, so the
// money rules can be tested exhaustively and every screen agrees.
//
// A membership has numbered periods: period 0 falls due on the billing start
// (the first payment's day, or the joining day until then), period n on that
// date n months later (pushed back by freezes). Each
// period owes the agreed fee in force on its due date. A payment fills its
// first period up to that fee, then flows on to the next, so a short payment
// is partial and a large one is an advance, with no special cases.
import { addDays, type IsoDate } from "@/lib/dates";
import {
  dueDates,
  feeOn,
  maxPeriods,
  type FeeChange,
  type MembershipFacts,
} from "@/members/billing";

/** Unpaid periods count as "due" from this many days before their due date. */
export const dueSoonDays = 3;

export interface LedgerPayment {
  id: string;
  firstPeriod: number;
  amountPaise: number;
  /** Orders payments that start on the same period. */
  createdAt: Date;
}

export type PeriodStatus =
  "paid" | "partial" | "due" | "overdue" | "upcoming" | "free";

export interface PeriodState {
  index: number;
  dueOn: IsoDate;
  feePaise: number;
  paidPaise: number;
  status: PeriodStatus;
}

/** A member's position as a whole, for lists, filters and reminders. */
export type Standing = "paid" | "due" | "overdue" | "free";

export interface Ledger {
  /**
   * Every period due up to a few days ahead, the next one after that, and
   * any further periods paid in advance.
   */
  periods: PeriodState[];
  /** Unpaid fees on periods already due. */
  owedPaise: number;
  /** Money with no period left to fill (e.g. during an open-ended freeze). */
  creditPaise: number;
  /** The earliest period not yet paid in full; what to collect next. */
  nextUnpaid: PeriodState | null;
  standing: Standing;
  /** The periods each payment went towards, by payment id. */
  coverage: Map<string, Coverage>;
}

export interface Coverage {
  first: PeriodState;
  last: PeriodState;
}

export interface MembershipWithFees extends MembershipFacts {
  fees: FeeChange[];
}

interface Period {
  index: number;
  dueOn: IsoDate;
  feePaise: number;
  paidPaise: number;
}

/**
 * Generates a membership's periods on demand. A period exists while it can
 * be dated (no open-ended freeze holds it) and falls due before the
 * membership ended: someone who leaves is not billed for the day they left.
 */
function periodSource(membership: MembershipWithFees) {
  const periods: Period[] = [];
  const dueOnFor = dueDates(membership.billingStartsOn, membership.freezes);
  let exhausted = false;

  return function periodAt(index: number): Period | null {
    while (!exhausted && periods.length <= index) {
      const next = periods.length;
      const dueOn = next < maxPeriods ? dueOnFor(next) : null;
      if (
        dueOn === null ||
        (membership.endedOn !== null && dueOn >= membership.endedOn)
      ) {
        exhausted = true;
        break;
      }
      periods.push({
        index: next,
        dueOn,
        feePaise: feeOn(membership.fees, dueOn) ?? 0,
        paidPaise: 0,
      });
    }
    return periods[index] ?? null;
  };
}

/**
 * `horizon` is today plus dueSoonDays, worked out once by the caller rather
 * than once per period.
 */
function statusOf(
  period: Period,
  today: IsoDate,
  horizon: IsoDate,
): PeriodStatus {
  if (period.feePaise === 0) return "free";
  if (period.paidPaise >= period.feePaise) return "paid";
  if (period.paidPaise > 0) return "partial";
  if (period.dueOn < today) return "overdue";
  if (period.dueOn <= horizon) return "due";
  return "upcoming";
}

function standingOf(
  periods: PeriodState[],
  membership: MembershipWithFees,
  today: IsoDate,
  horizon: IsoDate,
): Standing {
  const unpaid = (period: PeriodState) =>
    period.feePaise > 0 && period.paidPaise < period.feePaise;
  if (periods.some((p) => unpaid(p) && p.dueOn < today)) return "overdue";
  if (periods.some((p) => unpaid(p) && p.dueOn <= horizon)) return "due";
  if (feeOn(membership.fees, today) === 0) return "free";
  return "paid";
}

/** Works out every period's fee, payments and status for one membership. */
export function buildLedger(
  membership: MembershipWithFees,
  payments: LedgerPayment[],
  today: IsoDate,
): Ledger {
  const periodAt = periodSource(membership);
  const ordered = [...payments].sort(
    (a, b) =>
      a.firstPeriod - b.firstPeriod ||
      a.createdAt.getTime() - b.createdAt.getTime(),
  );

  let creditPaise = 0;
  let lastPaid = -1;
  const filled = new Map<string, { first: number; last: number }>();
  for (const payment of ordered) {
    let remaining = payment.amountPaise;
    let index = payment.firstPeriod;
    while (remaining > 0) {
      const period = periodAt(index);
      if (!period) {
        creditPaise += remaining;
        break;
      }
      const take = Math.min(remaining, period.feePaise - period.paidPaise);
      if (take > 0) {
        period.paidPaise += take;
        remaining -= take;
        lastPaid = Math.max(lastPaid, index);
        const span = filled.get(payment.id);
        filled.set(payment.id, { first: span?.first ?? index, last: index });
      }
      index++;
    }
  }

  const horizon = addDays(today, dueSoonDays);
  const periods: PeriodState[] = [];
  for (let index = 0; ; index++) {
    const period = periodAt(index);
    if (!period) break;
    periods.push({ ...period, status: statusOf(period, today, horizon) });
    if (period.dueOn > horizon && index >= lastPaid) break;
  }

  const owedPaise = periods
    .filter((period) => period.dueOn <= today)
    .reduce((sum, period) => sum + period.feePaise - period.paidPaise, 0);

  const coverage = new Map<string, Coverage>();
  for (const [id, span] of filled) {
    coverage.set(id, { first: periods[span.first], last: periods[span.last] });
  }

  return {
    periods,
    owedPaise,
    creditPaise,
    nextUnpaid:
      periods.find((period) => period.paidPaise < period.feePaise) ?? null,
    standing: standingOf(periods, membership, today, horizon),
    coverage,
  };
}

/**
 * The first due date on or after `today`, read off the periods the ledger
 * has already dated. For an open membership, and the `today` the ledger was
 * built for, this is exactly members/billing's nextDueDate (the periods run
 * past today, and stop where an open-ended freeze holds the next one), without
 * working every due date out a second time.
 */
export function nextDueFromLedger(
  ledger: Ledger,
  today: IsoDate,
): IsoDate | null {
  return ledger.periods.find((period) => period.dueOn >= today)?.dueOn ?? null;
}

/**
 * Periods a new payment can start from: anything not yet paid in full, then
 * future periods, so staff can take an advance. Oldest first, because money
 * usually settles the oldest debt.
 */
export function payablePeriods(
  membership: MembershipWithFees,
  payments: LedgerPayment[],
  today: IsoDate,
  ahead = 12,
): PeriodState[] {
  const ledger = buildLedger(membership, payments, today);
  const open = ledger.periods.filter(
    (period) => period.paidPaise < period.feePaise,
  );

  const periodAt = periodSource(membership);
  const horizon = addDays(today, dueSoonDays);
  const lastKnown = ledger.periods.at(-1)?.index ?? -1;
  const future: PeriodState[] = [];
  for (let index = lastKnown + 1; future.length < ahead; index++) {
    const period = periodAt(index);
    if (!period) break;
    if (period.feePaise > 0)
      future.push({ ...period, status: statusOf(period, today, horizon) });
  }
  return [...open, ...future];
}
