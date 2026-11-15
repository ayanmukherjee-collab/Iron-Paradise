// Due dates, freezes, fees and status for a membership (brief §4.2).
// Pure functions over plain data so the rules can be tested exhaustively and
// shared by every screen that shows a status.
import {
  addDays,
  addMonthsClamped,
  daysBetween,
  maxDate,
  type IsoDate,
} from "@/lib/dates";

export interface Freeze {
  startsOn: IsoDate;
  /** Last frozen day. Null: frozen until further notice. */
  endsOn: IsoDate | null;
}

export interface FeeChange {
  feePaise: number;
  effectiveFrom: IsoDate;
  createdAt: Date;
}

export interface MembershipFacts {
  startsOn: IsoDate;
  endedOn: IsoDate | null;
  freezes: Freeze[];
  /** Null when the viewer may not see fees (trainers). */
  fees: FeeChange[] | null;
}

export type MembershipStatus = "active" | "frozen" | "free" | "inactive";

// Fifty years of monthly dues; matches the check on payments.first_period.
export const maxPeriods = 600;

function freezeLength(freeze: Freeze & { endsOn: IsoDate }): number {
  return daysBetween(freeze.startsOn, freeze.endsOn) + 1;
}

/**
 * The date period `period` falls due. Period 0 is the joining day; period n
 * is the joining date n months on, clamped to month end. Every freeze that
 * starts on or before a due date pushes it (and all later ones) back by the
 * freeze's length. Returns null while an open-ended freeze holds it.
 */
export function dueDate(
  startsOn: IsoDate,
  period: number,
  freezes: Freeze[],
): IsoDate | null {
  const base = addMonthsClamped(startsOn, period);
  const pending = [...freezes]
    .filter((freeze) => freeze.startsOn >= startsOn)
    .sort((a, b) => a.startsOn.localeCompare(b.startsOn));

  let shift = 0;
  for (const freeze of pending) {
    const candidate = addDays(base, shift);
    if (freeze.startsOn > candidate) break;
    if (freeze.endsOn === null) return null;
    shift += freezeLength({ ...freeze, endsOn: freeze.endsOn });
  }
  return addDays(base, shift);
}

/** The first due date on or after `date`, or null while frozen indefinitely. */
export function nextDueDate(
  startsOn: IsoDate,
  freezes: Freeze[],
  date: IsoDate,
): IsoDate | null {
  for (let period = 0; period < maxPeriods; period++) {
    const due = dueDate(startsOn, period, freezes);
    if (due === null || due >= date) return due;
  }
  return null;
}

export function activeFreeze(freezes: Freeze[], today: IsoDate): Freeze | null {
  return (
    freezes.find(
      (freeze) =>
        freeze.startsOn <= today &&
        (freeze.endsOn === null || freeze.endsOn >= today),
    ) ?? null
  );
}

/**
 * The agreed fee on `date`: the newest change effective by then. A later
 * correction for the same date wins over an earlier entry.
 */
export function feeOn(fees: FeeChange[], date: IsoDate): number | null {
  let current: FeeChange | null = null;
  for (const fee of fees) {
    if (fee.effectiveFrom > date) continue;
    if (
      !current ||
      fee.effectiveFrom > current.effectiveFrom ||
      (fee.effectiveFrom === current.effectiveFrom &&
        fee.createdAt > current.createdAt)
    ) {
      current = fee;
    }
  }
  return current?.feePaise ?? null;
}

/**
 * When a fee change takes effect: the next due date, so months already due
 * keep the fee agreed for them. During an open-ended freeze, from today.
 */
export function feeChangeEffectiveFrom(
  membership: MembershipFacts,
  today: IsoDate,
): IsoDate {
  return nextDueDate(membership.startsOn, membership.freezes, today) ?? today;
}

export function membershipStatus(
  memberIsActive: boolean,
  membership: MembershipFacts | null,
  today: IsoDate,
): MembershipStatus {
  if (!memberIsActive || !membership || membership.endedOn) return "inactive";
  if (activeFreeze(membership.freezes, today)) return "frozen";
  if (membership.fees && feeOn(membership.fees, today) === 0) return "free";
  return "active";
}

/**
 * A member "goes quiet" after `days` with no visit and no payment. Joining
 * counts as activity, so new members are not flagged in their first weeks.
 * This only suggests; staff decide (brief §4.2).
 */
export function isGoneQuiet(input: {
  startsOn: IsoDate;
  lastVisit: IsoDate | null;
  lastPayment: IsoDate | null;
  today: IsoDate;
  days: number;
}): boolean {
  const lastActivity = maxDate(
    input.startsOn,
    input.lastVisit,
    input.lastPayment,
  )!;
  return daysBetween(lastActivity, input.today) >= input.days;
}
