// Quick record with a plan: "3 months" means pay the next three monthly fees
// in one go. A payment fills periods oldest first and flows on to the next
// (ledger.ts), so paying exactly what the next N unpaid periods still owe
// moves the next due date N months on, with no special case in the ledger.
import { addMonthsClamped, type IsoDate } from "@/lib/dates";
import type { PeriodState } from "@/payments/ledger";

export interface PlanQuote {
  /** What the next `months` unpaid periods still owe, together. */
  amountPaise: number;
  /** The due date of the last period it pays. */
  lastPaidDueOn: IsoDate;
  /** The next fee after those, if the form lists it. */
  nextDueOn: IsoDate | null;
}

/**
 * Prices `months` periods from `firstPeriod` in a list of payable periods
 * (payablePeriods: every unpaid period, then future ones, oldest first, each
 * one a payment would fill in turn). Null when the list doesn't reach that
 * far or the periods cost nothing.
 */
export function planQuote(
  periods: PeriodState[],
  firstPeriod: number,
  months: number,
): PlanQuote | null {
  const start = periods.findIndex((period) => period.index === firstPeriod);
  if (start < 0 || months < 1) return null;
  const paid = periods.slice(start, start + months);
  if (paid.length < months) return null;
  const amountPaise = paid.reduce(
    (sum, period) => sum + period.feePaise - period.paidPaise,
    0,
  );
  if (amountPaise <= 0) return null;
  return {
    amountPaise,
    lastPaidDueOn: paid.at(-1)!.dueOn,
    nextDueOn: periods[start + months]?.dueOn ?? null,
  };
}

/**
 * A first payment starts the dues on the day staff pick (or the day it was
 * paid), so the periods the form listed may move: the next fee then falls
 * `months` after that day.
 */
export function firstPaymentNextDue(start: IsoDate, months: number): IsoDate {
  return addMonthsClamped(start, months);
}
