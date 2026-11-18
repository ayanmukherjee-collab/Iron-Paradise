// The one-off switch to paying by months (migration *_pay_by_months.sql):
// every old payment is wiped, and each membership's dues restart at the
// first month its old payments left unpaid. Worked out here, with the old
// money rule, so nobody who was paid up becomes overdue and nobody who owed
// is let off. Pure, so it can be tested before it touches the live data.
//
// The old rule: each month owed the fee in force on its due date (the
// change with the latest start winning), and a payment filled its first
// month up to that fee, then flowed on to the next.
import type { DueChangeRow } from "@/db/schema";
import type { IsoDate } from "@/lib/dates";
import {
  dueDate,
  dueDates,
  maxPeriods,
  rescheduled,
  type FeeChange,
} from "@/members/billing";
import type { MembershipWithFees } from "@/payments/ledger";

export interface OldPayment {
  firstPeriod: number;
  amountPaise: number;
  createdAt: Date;
}

export interface ResetPlan {
  membershipId: string;
  /** The old period that becomes period 0. */
  shift: number;
  dueChanges: DueChangeRow[];
  /** Money on the first unpaid month that the wipe drops (part payment). */
  droppedPartPaise: number;
}

/** The fee on `date` as the old rule read it: the latest start wins. */
export function oldFeeOn(fees: FeeChange[], date: IsoDate): number | null {
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
      fee.effectiveFrom > current.effectiveFrom ||
      (fee.effectiveFrom === current.effectiveFrom &&
        fee.createdAt > current.createdAt)
    ) {
      current = fee;
    }
  }
  return (current ?? first)?.feePaise ?? null;
}

/**
 * The first month the old payments left unpaid (or part paid), and how much
 * was paid towards it; for a member who went free, the first free month
 * after the last paid one. A month that can't be dated (an open-ended
 * freeze holds it) or falls on or after the end counts as the stopping
 * point.
 */
export function firstUnpaid(
  membership: MembershipWithFees,
  payments: OldPayment[],
): { period: number; paidPaise: number } {
  const dueOn = dueDates(membership);
  const fee: number[] = [];
  const paid: number[] = [];
  const exists = (index: number): boolean => {
    if (index >= maxPeriods) return false;
    const due = dueOn(index);
    if (due === null) return false;
    if (membership.endedOn !== null && due >= membership.endedOn) return false;
    if (fee[index] === undefined) {
      fee[index] = oldFeeOn(membership.fees, due) ?? 0;
      paid[index] = 0;
    }
    return true;
  };

  const ordered = [...payments].sort(
    (a, b) =>
      a.firstPeriod - b.firstPeriod ||
      a.createdAt.getTime() - b.createdAt.getTime(),
  );
  let lastPaid = -1;
  for (const payment of ordered) {
    let remaining = payment.amountPaise;
    let index = payment.firstPeriod;
    while (remaining > 0 && exists(index)) {
      const take = Math.min(remaining, fee[index] - paid[index]);
      if (take > 0) {
        paid[index] += take;
        remaining -= take;
        lastPaid = Math.max(lastPaid, index);
      }
      index++;
    }
  }

  // Free months between paid ones are skipped; from the first free month
  // after the last paid one, there is nothing more to collect.
  for (let index = 0; ; index++) {
    if (!exists(index)) return { period: index, paidPaise: 0 };
    if (fee[index] === 0 ? index > lastPaid : paid[index] < fee[index]) {
      return { period: index, paidPaise: paid[index] };
    }
  }
}

/**
 * The new schedule for one membership with counted payments: period
 * `shift` of the old schedule becomes period 0, on the same date, and
 * every later month keeps its date too. Null when no schedule can say that
 * (it shouldn't happen; the caller reports it).
 */
export function planReset(
  membershipId: string,
  membership: MembershipWithFees,
  payments: OldPayment[],
): ResetPlan | null {
  const { period: shift, paidPaise } = firstUnpaid(membership, payments);
  const wanted = shift < maxPeriods ? dueDate(membership, shift) : null;

  let base: { fromPeriod: number; dueOn: IsoDate }[] | null;
  if (wanted === null) {
    // An open-ended freeze holds the month: dues start where it began, so
    // the freeze still holds them, and run from the day it ends.
    const open = membership.freezes.find((freeze) => freeze.endsOn === null);
    base = open ? [{ fromPeriod: 0, dueOn: open.startsOn }] : null;
  } else {
    base = rescheduled({ ...membership, dueChanges: [] }, 0, wanted);
  }
  if (!base) return null;

  const later = membership.dueChanges
    .filter((change) => change.fromPeriod > shift)
    .map((change) => ({
      fromPeriod: change.fromPeriod - shift,
      dueOn: change.dueOn,
    }));
  const changes = [...base, ...later];
  for (let i = 1; i < changes.length; i++) {
    if (changes[i].dueOn <= changes[i - 1].dueOn) return null;
  }

  return {
    membershipId,
    shift,
    dueChanges: changes.map((change) => ({
      from_period: change.fromPeriod,
      due_on: change.dueOn,
    })),
    droppedPartPaise: paidPaise,
  };
}

/**
 * Months (up to `count`) where the new schedule's due date differs from
 * the old one's, both dated. Empty means the restart moved nothing.
 */
export function scheduleDifferences(
  membership: MembershipWithFees,
  plan: ResetPlan,
  count = 36,
): number[] {
  const before = dueDates(membership);
  const after = dueDates({
    ...membership,
    dueChanges: plan.dueChanges.map((change) => ({
      fromPeriod: change.from_period,
      dueOn: change.due_on,
    })),
  });
  const differ: number[] = [];
  for (let i = 0; i < count; i++) {
    const old = before(plan.shift + i);
    const now = after(i);
    if (old !== null && now !== null && old !== now) differ.push(i);
  }
  return differ;
}
