// Words for payment states, shared by every payments screen and export so a
// cell, a badge and a spreadsheet all say the same thing.
import { formatDate } from "@/lib/dates";
import { formatPaise } from "@/lib/money";
import type { Ledger, PeriodState, Standing } from "@/payments/ledger";
import type { CellStatus } from "@/payments/sheet";

export const cellLabels: Record<CellStatus, string> = {
  paid: "Paid",
  due: "Due",
  overdue: "Overdue",
  upcoming: "Upcoming",
  free: "Free",
  frozen: "Frozen",
  none: "",
};

export const standingLabels: Record<Standing, string> = {
  paid: "Paid up",
  due: "Due soon",
  overdue: "Overdue",
  free: "Free",
};

export const methodLabels = { cash: "Cash", upi: "UPI", other: "Other" };

/** "12 Mar 2026 · ₹600", the month and its fee. */
export function describePeriod(period: PeriodState): string {
  return `${formatDate(period.dueOn)} · ${formatPaise(period.feePaise)}`;
}

/** The line staff see after recording a payment: what it actually covered. */
export function describeRecordedPayment(
  ledger: Ledger,
  paymentId: string,
  amountPaise: number,
): string {
  const recorded = `Recorded ${formatPaise(amountPaise)}`;
  const span = ledger.coverage.get(paymentId);
  if (!span) {
    return `${recorded}. Its months start once the freeze ends.`;
  }

  const { first, last } = span;
  const next = ledger.periods.find((period) => period.index > last.index);
  const nextDue = next ? ` Next due ${formatDate(next.dueOn)}.` : "";
  if (first.index === last.index) {
    return `${recorded} for ${formatDate(first.dueOn)}.${nextDue}`;
  }
  return `${recorded}, covering ${formatDate(first.dueOn)} to ${formatDate(last.dueOn)}.${nextDue}`;
}
