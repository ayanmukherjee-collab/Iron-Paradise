// Due dates, freezes, fees and status for a membership (brief §4.2).
// Pure functions over plain data so the rules can be tested exhaustively and
// shared by every screen that shows a status.
import {
  addDays,
  daysBetween,
  maxDate,
  monthsAfter,
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
  /** The joining day. */
  startsOn: IsoDate;
  /**
   * The day period 0 falls due: the first payment's day, or the joining day
   * until the member first pays. Sets the monthly due day.
   */
  billingStartsOn: IsoDate;
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
 * The date period `period` falls due. Period 0 falls due on the billing
 * start (the first payment's day, else the joining day); period n is that
 * date n months on, clamped to month end. Every freeze that starts on or
 * before a due date pushes it (and all later ones) back by the freeze's
 * length. Returns null while an open-ended freeze holds it.
 */
export function dueDate(
  billingStartsOn: IsoDate,
  period: number,
  freezes: Freeze[],
): IsoDate | null {
  return dueDates(billingStartsOn, freezes)(period);
}

/**
 * dueDate for any period of one membership. Ledgers and nextDueDate ask for
 * many periods in a row, so the freezes are filtered and sorted once here
 * rather than on every call.
 */
export function dueDates(
  billingStartsOn: IsoDate,
  freezes: Freeze[],
): (period: number) => IsoDate | null {
  const baseOf = monthsAfter(billingStartsOn);
  // Most memberships were never frozen; nothing would move their dates.
  if (freezes.length === 0) return baseOf;

  const pending = [...freezes]
    .filter((freeze) => freeze.startsOn >= billingStartsOn)
    .sort((a, b) => a.startsOn.localeCompare(b.startsOn));
  return (period) => {
    const base = baseOf(period);
    let shift = 0;
    for (const freeze of pending) {
      const candidate = addDays(base, shift);
      if (freeze.startsOn > candidate) break;
      if (freeze.endsOn === null) return null;
      shift += freezeLength({ ...freeze, endsOn: freeze.endsOn });
    }
    return addDays(base, shift);
  };
}

/**
 * The first due date on or after `date`, or null while frozen indefinitely.
 *
 * That is the first period that is "reached": due on or after `date`, or held
 * by an open-ended freeze. Later periods fall due later (a freeze only ever
 * pushes them further back), and once a freeze holds one period it holds every
 * later one, so reached is false up to some period and true from then on.
 * Rather than try every month since joining, gallop (0, 2, 6, 14, …) to a
 * reached period and then halve the gap: about 2·log₂ months of work instead
 * of one dueDate per month, for exactly the same answer.
 */
export function nextDueDate(
  billingStartsOn: IsoDate,
  freezes: Freeze[],
  date: IsoDate,
): IsoDate | null {
  const dueOn = dueDates(billingStartsOn, freezes);
  const reached = (due: IsoDate | null) => due === null || due >= date;
  let before = -1; // A period known to fall due before `date` (-1: none yet).
  let after = maxPeriods; // A reached period (maxPeriods: none found).
  let afterDue: IsoDate | null = null;

  for (let step = 1; before + step < maxPeriods; step *= 2) {
    const period = before + step;
    const due = dueOn(period);
    if (reached(due)) {
      after = period;
      afterDue = due;
      break;
    }
    before = period;
  }
  while (after - before > 1) {
    const period = Math.floor((before + after) / 2);
    const due = dueOn(period);
    if (reached(due)) {
      after = period;
      afterDue = due;
    } else {
      before = period;
    }
  }
  return after < maxPeriods ? afterDue : null;
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
  return (
    nextDueDate(membership.billingStartsOn, membership.freezes, today) ?? today
  );
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
