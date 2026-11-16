// Which reminder, if any, a membership is due today (brief §4.6). Pure
// functions over a ledger so the rules can be tested without a database.
//
// The daily job reminds three times per fee: 3 days before, on the day, and
// 3 days after. Each reminder is keyed by (period, stage) and logged, so a
// payment stops the next one and nothing is sent twice.
import { daysBetween, type IsoDate } from "@/lib/dates";
import { dueSoonDays, type Ledger, type PeriodState } from "@/payments/ledger";

export type ReminderStage = "due_soon" | "due_today" | "overdue";

export const daysOverdue = 3;

/**
 * The overdue reminder still goes out if the job missed its exact day, for a
 * few days. Older debts are left to staff, so nobody gets a flood of old
 * reminders the day this feature is switched on.
 */
const missedRunGraceDays = 4;

/**
 * "automatic": the daily job's windows.
 * "staff": what the WhatsApp queue offers. Staff can chase any overdue fee,
 * however old, so overdue has no upper limit there.
 */
export type ReminderMode = "automatic" | "staff";

export interface DueReminder {
  stage: ReminderStage;
  /** The fee period this reminder is about. */
  period: number;
  dueOn: IsoDate;
  /** The oldest unpaid due date included in the amount. */
  unpaidSince: IsoDate;
  /** Everything unpaid up to and including this period. */
  amountPaise: number;
}

export function stageOn(
  dueOn: IsoDate,
  today: IsoDate,
  mode: ReminderMode,
): ReminderStage | null {
  const daysLeft = daysBetween(today, dueOn);
  if (daysLeft >= 1 && daysLeft <= dueSoonDays) return "due_soon";
  if (daysLeft === 0) return "due_today";
  const late = -daysLeft;
  if (mode === "staff") return late > 0 ? "overdue" : null;
  if (late >= daysOverdue && late <= daysOverdue + missedRunGraceDays)
    return "overdue";
  return null;
}

function unpaid(period: PeriodState): number {
  return Math.max(period.feePaise - period.paidPaise, 0);
}

/**
 * The reminder to send for this ledger today, or null. When several periods
 * qualify, the latest one is chosen and its amount includes every earlier
 * unpaid fee, so the member gets one message with the full figure.
 */
export function reminderFor(
  ledger: Ledger,
  today: IsoDate,
  mode: ReminderMode,
): DueReminder | null {
  const open = ledger.periods.filter((period) => unpaid(period) > 0);

  let chosen: { period: PeriodState; stage: ReminderStage } | null = null;
  for (const period of open) {
    const stage = stageOn(period.dueOn, today, mode);
    if (stage) chosen = { period, stage };
  }
  if (!chosen) return null;

  const included = open.filter((period) => period.dueOn <= chosen.period.dueOn);
  return {
    stage: chosen.stage,
    period: chosen.period.index,
    dueOn: chosen.period.dueOn,
    unpaidSince: included[0].dueOn,
    amountPaise: included.reduce((sum, period) => sum + unpaid(period), 0),
  };
}
