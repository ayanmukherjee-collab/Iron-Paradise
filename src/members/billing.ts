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

/**
 * Staff moved the due date: period `fromPeriod` falls due on `dueOn` and
 * every later period on the same day of later months. `dueOn` is the date
 * before freezes push it (see dueBaseFor). See memberships.due_changes.
 */
export interface DueChange {
  fromPeriod: number;
  dueOn: IsoDate;
}

/** What fixes a membership's due dates. */
export interface Schedule {
  /**
   * The day period 0 falls due: the first payment's day, or the joining day
   * until the member first pays. Sets the monthly due day.
   */
  billingStartsOn: IsoDate;
  /** Oldest first, with strictly later periods and dates. */
  dueChanges: DueChange[];
  freezes: Freeze[];
}

export interface MembershipFacts extends Schedule {
  /** The joining day. */
  startsOn: IsoDate;
  endedOn: IsoDate | null;
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
 * date n months on, clamped to month end. From a due change on, periods
 * count months from the change instead. Every freeze that starts on or
 * before a due date pushes it (and all later ones) back by the freeze's
 * length. Returns null while an open-ended freeze holds it.
 */
export function dueDate(schedule: Schedule, period: number): IsoDate | null {
  return dueDates(schedule)(period);
}

/**
 * dueDate for any period of one membership. Ledgers and nextDueDate ask for
 * many periods in a row, so the freezes are filtered and sorted once here
 * rather than on every call.
 */
export function dueDates(
  schedule: Schedule,
): (period: number) => IsoDate | null {
  const { billingStartsOn, dueChanges, freezes } = schedule;
  const segments = [
    { fromPeriod: 0, monthsOn: monthsAfter(billingStartsOn) },
    ...dueChanges.map((change) => ({
      fromPeriod: change.fromPeriod,
      monthsOn: monthsAfter(change.dueOn),
    })),
  ];
  // Most memberships never had their due date moved.
  const baseOf =
    segments.length === 1
      ? segments[0].monthsOn
      : (period: number) => {
          let segment = segments[0];
          for (const next of segments) {
            if (next.fromPeriod > period) break;
            segment = next;
          }
          return segment.monthsOn(period - segment.fromPeriod);
        };
  // Most memberships were never frozen; nothing would move their dates.
  if (freezes.length === 0) return baseOf;

  const firstDue =
    dueChanges[0]?.fromPeriod === 0 ? dueChanges[0].dueOn : billingStartsOn;
  const pending = [...freezes]
    .filter((freeze) => freeze.startsOn >= firstDue)
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
 * The schedule after moving period `period` to fall due on `wanted`, with
 * every later period following on from it; or null when `wanted` cannot be
 * that period's due date. Changes from `period` on are replaced, so the
 * newest change wins.
 *
 * A change stores the date before freezes push it, so a freeze added later
 * pushes the moved dates like any other. Here that date is found so the
 * period falls due on exactly `wanted` under today's freezes: going back a
 * day at a time from `wanted`, at most the total of the freezes' lengths.
 * Null when `wanted` is a frozen day, an open-ended freeze holds it, or it
 * is not after the previous period's due date (dates never go backwards).
 */
export function rescheduled(
  schedule: Schedule,
  period: number,
  wanted: IsoDate,
): DueChange[] | null {
  if (period < 0 || period >= maxPeriods) return null;
  if (period > 0) {
    const previous = dueDate(schedule, period - 1);
    if (previous === null || wanted <= previous) return null;
  }
  const kept = schedule.dueChanges.filter(
    (change) => change.fromPeriod < period,
  );
  const frozenDays = schedule.freezes.reduce(
    (total, freeze) =>
      freeze.endsOn === null
        ? total
        : total + freezeLength({ ...freeze, endsOn: freeze.endsOn }),
    0,
  );
  for (let back = 0; back <= frozenDays; back++) {
    const dueChanges = [
      ...kept,
      { fromPeriod: period, dueOn: addDays(wanted, -back) },
    ];
    // Bases must rise like the dates (memberships_due_changes_valid).
    const prior = kept.at(-1);
    if (prior && dueChanges.at(-1)!.dueOn <= prior.dueOn) return null;
    if (dueDate({ ...schedule, dueChanges }, period) === wanted)
      return dueChanges;
  }
  return null;
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
export function nextDueDate(schedule: Schedule, date: IsoDate): IsoDate | null {
  const dueOn = dueDates(schedule);
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
 * The agreed fee on `date`: of the changes in effect by then, the one saved
 * last. So the newest edit always wins from the day it applies, even over an
 * older change that was dated later. Before the first fee took effect, the
 * first fee: dues can start before the joining day when staff move them
 * there.
 */
export function feeOn(fees: FeeChange[], date: IsoDate): number | null {
  let current: FeeChange | null = null;
  let first: FeeChange | null = null;
  for (const fee of fees) {
    if (
      !first ||
      fee.effectiveFrom < first.effectiveFrom ||
      (fee.effectiveFrom === first.effectiveFrom &&
        fee.createdAt > first.createdAt)
    ) {
      first = fee;
    }
    if (fee.effectiveFrom > date) continue;
    if (
      !current ||
      fee.createdAt > current.createdAt ||
      (fee.createdAt.getTime() === current.createdAt.getTime() &&
        fee.effectiveFrom > current.effectiveFrom)
    ) {
      current = fee;
    }
  }
  return (current ?? first)?.feePaise ?? null;
}

/**
 * When a fee change takes effect: straight away, for the month the member
 * is in now. That is the latest due date on or before today, so this
 * month's fee (if it isn't paid yet) and every later one use the new fee,
 * while earlier months keep the fee agreed for them. Before the first due
 * date, or with no date to go by, from today.
 */
export function feeChangeEffectiveFrom(
  membership: MembershipFacts,
  today: IsoDate,
): IsoDate {
  const dueOn = dueDates(membership);
  let current: IsoDate | null = null;
  for (let period = 0; period < maxPeriods; period++) {
    const due = dueOn(period);
    if (due === null || due > today) break;
    current = due;
  }
  return current ?? today;
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
