// Words for payment states, shared by every payments screen and export so a
// cell, a badge and a spreadsheet all say the same thing.
import { formatDate } from "@/lib/dates";
import { formatPaise } from "@/lib/money";
import type { Ledger, PeriodState, Standing } from "@/payments/ledger";
import type { CellStatus } from "@/payments/sheet";

export const cellLabels: Record<CellStatus, string> = {
  paid: "Paid",
  partial: "Partial",
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

/** "12 Mar 2026 · ₹600 due" or "12 Mar 2026 · ₹300 of ₹600 paid". */
export function describePeriod(period: PeriodState): string {
  const when = formatDate(period.dueOn);
  if (period.paidPaise === 0)
    return `${when} · ${formatPaise(period.feePaise)}`;
  return `${when} · ${formatPaise(period.paidPaise)} of ${formatPaise(period.feePaise)} paid`;
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
    return `${recorded}. Nothing is due for it yet, so it is held as credit.`;
  }

  const { first, last } = span;
  const shortBy = last.feePaise - last.paidPaise;
  const short =
    shortBy > 0
      ? ` ${formatPaise(shortBy)} is still due for ${formatDate(last.dueOn)}.`
      : "";
  if (first.index === last.index) {
    return `${recorded} for ${formatDate(first.dueOn)}.${short}`;
  }
  return `${recorded}, covering ${formatDate(first.dueOn)} to ${formatDate(last.dueOn)}.${short}`;
}
