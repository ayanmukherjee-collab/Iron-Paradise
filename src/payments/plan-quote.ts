// The next due date a payment would leave, shown on the record form before
// saving. A payment pays for whole months (ledger.ts), so this is only ever
// counting months, never money.
import { addMonthsClamped, type IsoDate } from "@/lib/dates";
import type { PeriodState } from "@/payments/ledger";

/**
 * After paying `months` months from `firstPeriod`, the due date of the
 * month after them, read from the form's list of payable periods (every
 * unpaid one, then future ones). Null when the list doesn't reach that far.
 */
export function nextDueAfter(
  periods: PeriodState[],
  firstPeriod: number,
  months: number,
): IsoDate | null {
  return (
    periods.find((period) => period.index === firstPeriod + months)?.dueOn ??
    null
  );
}

/**
 * A first payment starts the dues on the day staff pick (or the day it was
 * paid), so the periods the form listed may move: the next fee then falls
 * `months` after that day.
 */
export function firstPaymentNextDue(start: IsoDate, months: number): IsoDate {
  return addMonthsClamped(start, months);
}
