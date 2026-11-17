// Three shortcuts that keep the Worker inside its CPU allowance, each held to
// the long way round over thousands of generated memberships:
// - nextDueDate searches for the next due date instead of trying every month;
// - lists build ledgers from payments summed per starting period;
// - lists read the next due date off the ledger instead of working it out.
import { describe, expect, it } from "vitest";
import { addDays, addMonthsClamped, daysBetween } from "@/lib/dates";
import {
  dueDate,
  dueDates,
  maxPeriods,
  nextDueDate,
  rescheduled,
  type FeeChange,
  type Freeze,
} from "@/members/billing";
import {
  buildLedger,
  nextDueFromLedger,
  type Ledger,
  type LedgerPayment,
  type MembershipWithFees,
} from "@/payments/ledger";

/** A small seeded generator, so a failure can be replayed. */
function random(seed: number) {
  let state = seed >>> 0;
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const int = (min: number, max: number) =>
    min + Math.floor(next() * (max - min + 1));
  return {
    next,
    int,
    pick: <T>(items: T[]) => items[int(0, items.length - 1)],
  };
}

type Random = ReturnType<typeof random>;

function someMembership(r: Random): MembershipWithFees {
  // Month ends (29th–31st) clamp in short months: the awkward case.
  const startsOn = addDays("2021-01-01", r.int(0, 365 * 5));
  const billingStartsOn =
    r.next() < 0.3 ? startsOn : addDays(startsOn, r.int(0, 40));
  const freezes: Freeze[] = [];
  for (let i = r.pick([0, 0, 0, 1, 1, 2, 3]); i > 0; i--) {
    const from = addDays(billingStartsOn, r.int(-60, 900));
    freezes.push({
      startsOn: from,
      endsOn: r.next() < 0.2 ? null : addDays(from, r.int(0, 90)),
    });
  }
  const fees: FeeChange[] = [
    {
      feePaise: r.pick([60000, 80000, 0]),
      effectiveFrom: startsOn,
      createdAt: new Date(0),
    },
  ];
  if (r.next() < 0.3) {
    fees.push({
      feePaise: r.pick([50000, 90000, 0]),
      effectiveFrom: addDays(startsOn, r.int(30, 700)),
      createdAt: new Date(1000),
    });
  }
  return {
    startsOn,
    billingStartsOn,
    dueChanges: [],
    endedOn: null,
    freezes,
    fees,
  };
}

function somePayments(r: Random): LedgerPayment[] {
  const payments: LedgerPayment[] = [];
  const count = r.int(0, 30);
  for (let i = 0; i < count; i++) {
    payments.push({
      id: `payment-${i}`,
      // Small range, so several payments often start on the same period.
      firstPeriod: r.int(0, 20),
      amountPaise: r.pick([10000, 30000, 60000, 80000, 120000, 240000]),
      createdAt: new Date(Date.UTC(2024, 0, 1) + r.int(0, 1e9)),
    });
  }
  return payments;
}

/** dueDate exactly as it was: freezes copied, filtered and sorted per call. */
function originalDueDate(
  billingStartsOn: string,
  period: number,
  freezes: Freeze[],
): string | null {
  const base = addMonthsClamped(billingStartsOn, period);
  const pending = [...freezes]
    .filter((freeze) => freeze.startsOn >= billingStartsOn)
    .sort((a, b) => a.startsOn.localeCompare(b.startsOn));
  let shift = 0;
  for (const freeze of pending) {
    const candidate = addDays(base, shift);
    if (freeze.startsOn > candidate) break;
    if (freeze.endsOn === null) return null;
    shift += daysBetween(freeze.startsOn, freeze.endsOn) + 1;
  }
  return addDays(base, shift);
}

/** nextDueDate exactly as it was: every period from 0 until one fits. */
function originalNextDueDate(
  billingStartsOn: string,
  freezes: Freeze[],
  date: string,
): string | null {
  for (let period = 0; period < maxPeriods; period++) {
    const due = originalDueDate(billingStartsOn, period, freezes);
    if (due === null || due >= date) return due;
  }
  return null;
}

/** someMembership with its due date moved by staff up to three times. */
function someMovedMembership(r: Random): MembershipWithFees {
  const membership = someMembership(r);
  for (let i = r.int(1, 3); i > 0; i--) {
    const period = r.pick([0, r.int(1, 40)]);
    const previous = period > 0 ? dueDate(membership, period - 1) : null;
    if (period > 0 && previous === null) continue;
    const wanted = previous
      ? addDays(previous, r.int(-5, 60))
      : addDays(membership.billingStartsOn, r.int(-90, 90));
    const changes = rescheduled(membership, period, wanted);
    if (changes) membership.dueChanges = changes;
  }
  return membership;
}

/** The ledger with `coverage` left out: everything a list shows. */
function shown(ledger: Ledger) {
  const { coverage, ...rest } = ledger;
  void coverage;
  return rest;
}

/** As countedTotals returns them: one sum per first period. */
function summed(payments: LedgerPayment[]): LedgerPayment[] {
  const totals = new Map<number, number>();
  for (const payment of payments) {
    totals.set(
      payment.firstPeriod,
      (totals.get(payment.firstPeriod) ?? 0) + payment.amountPaise,
    );
  }
  return [...totals].map(([firstPeriod, amountPaise]) => ({
    id: `from-period-${firstPeriod}`,
    firstPeriod,
    amountPaise,
    createdAt: new Date(0),
  }));
}

describe("due dates", () => {
  it("dueDate gives what it always gave", () => {
    const r = random(1);
    for (let i = 0; i < 2000; i++) {
      const { billingStartsOn, freezes } = someMembership(r);
      for (let period = 0; period < 70; period += r.int(1, 5)) {
        expect(
          dueDate({ billingStartsOn, dueChanges: [], freezes }, period),
        ).toBe(originalDueDate(billingStartsOn, period, freezes));
      }
    }
  });

  it("moved due dates never go backwards and nextDueDate still finds them", () => {
    const r = random(5);
    for (let i = 0; i < 800; i++) {
      const membership = someMovedMembership(r);
      const dueOn = dueDates(membership);
      const dates: string[] = [];
      for (let period = 0; period < 80; period++) {
        const due = dueOn(period);
        if (due === null) break;
        dates.push(due);
      }
      for (let k = 1; k < dates.length; k++) {
        expect(dates[k] > dates[k - 1], `case ${i}, period ${k}`).toBe(true);
      }
      const date = addDays(membership.billingStartsOn, r.int(-100, 2400));
      let expected: string | null = null;
      for (let period = 0; period < maxPeriods; period++) {
        const due = dueOn(period);
        if (due === null || due >= date) {
          expected = due;
          break;
        }
      }
      expect(nextDueDate(membership, date), `case ${i}`).toBe(expected);
    }
  });

  it("nextDueDate finds the same date as trying every month", () => {
    const r = random(2);
    for (let i = 0; i < 2000; i++) {
      const { billingStartsOn, freezes } = someMembership(r);
      // From before the billing start to decades on, past the last period.
      const date = r.pick([
        addDays(billingStartsOn, r.int(-100, 0)),
        addDays(billingStartsOn, r.int(0, 3000)),
        addDays(billingStartsOn, r.int(17000, 19000)),
        billingStartsOn,
      ]);
      expect(
        nextDueDate({ billingStartsOn, dueChanges: [], freezes }, date),
        `case ${i}`,
      ).toBe(originalNextDueDate(billingStartsOn, freezes, date));
    }
  });
});

describe("ledgers for lists", () => {
  it("summing payments per first period changes nothing a list shows", () => {
    const r = random(3);
    for (let i = 0; i < 1500; i++) {
      const membership = someMembership(r);
      if (r.next() < 0.2) {
        membership.endedOn = addDays(membership.startsOn, r.int(1, 900));
      }
      const payments = somePayments(r);
      const today = addDays(membership.startsOn, r.int(0, 1500));
      expect(
        shown(buildLedger(membership, summed(payments), today)),
        `case ${i}`,
      ).toEqual(shown(buildLedger(membership, payments, today)));
    }
  });

  it("the next due date read off an open membership's ledger is nextDueDate's", () => {
    const r = random(4);
    for (let i = 0; i < 1500; i++) {
      const membership = someMembership(r);
      const today = addDays(membership.startsOn, r.int(-30, 1500));
      const ledger = buildLedger(membership, somePayments(r), today);
      expect(nextDueFromLedger(ledger, today), `case ${i}`).toBe(
        originalNextDueDate(
          membership.billingStartsOn,
          membership.freezes,
          today,
        ),
      );
    }
  });
});
