import { describe, expect, it } from "vitest";
import { buildLedger, type MembershipWithFees } from "@/payments/ledger";
import {
  firstUnpaid,
  planReset,
  scheduleDifferences,
  type OldPayment,
} from "@/payments/reset-plan";

const fee = (feePaise: number, effectiveFrom: string, at = 0) => ({
  feePaise,
  effectiveFrom,
  createdAt: new Date(at),
});

const membership = (
  overrides: Partial<MembershipWithFees> = {},
): MembershipWithFees => ({
  startsOn: "2026-01-10",
  billingStartsOn: "2026-01-10",
  dueChanges: [],
  endedOn: null,
  freezes: [],
  fees: [fee(60000, "2026-01-10")],
  ...overrides,
});

const pay = (amountPaise: number, firstPeriod = 0, at = 0): OldPayment => ({
  firstPeriod,
  amountPaise,
  createdAt: new Date(at),
});

describe("firstUnpaid", () => {
  it("finds the month after everything paid, advances included", () => {
    expect(firstUnpaid(membership(), [pay(180000)])).toEqual({
      period: 3,
      paidPaise: 0,
    });
  });

  it("stops at a part-paid month and says what was paid on it", () => {
    expect(firstUnpaid(membership(), [pay(90000)])).toEqual({
      period: 1,
      paidPaise: 30000,
    });
  });

  it("stops at the first free month after the last paid one", () => {
    const m = membership({
      fees: [fee(60000, "2026-01-10", 0), fee(0, "2026-03-10", 1)],
    });
    expect(firstUnpaid(m, [pay(120000)]).period).toBe(2);
  });

  it("skips a free month between paid ones", () => {
    const m = membership({
      fees: [
        fee(60000, "2026-01-10", 0),
        fee(0, "2026-02-10", 1),
        fee(60000, "2026-03-10", 2),
      ],
    });
    // Jan and Mar paid; Feb free in between.
    expect(firstUnpaid(m, [pay(120000)]).period).toBe(3);
  });

  it("reads fees the old way, the latest start winning", () => {
    const m = membership({
      fees: [fee(60000, "2026-01-10", 0), fee(80000, "2026-02-10", 1)],
    });
    // Jan 600 + Feb 800 = 1400.
    expect(firstUnpaid(m, [pay(140000)]).period).toBe(2);
  });
});

describe("planReset", () => {
  it("restarts the dues on the first unpaid month's date, and keeps every later date", () => {
    const m = membership();
    const plan = planReset("m1", m, [pay(180000)])!;
    expect(plan).toMatchObject({
      shift: 3,
      dueChanges: [{ from_period: 0, due_on: "2026-04-10" }],
      droppedPartPaise: 0,
    });
    expect(scheduleDifferences(m, plan)).toEqual([]);

    // Paid up in March: nothing owed, next due 10 Apr.
    const restarted = membership({
      dueChanges: [{ fromPeriod: 0, dueOn: "2026-04-10" }],
    });
    const ledger = buildLedger(restarted, [], "2026-03-20");
    expect(ledger.owedPaise).toBe(0);
    expect(ledger.nextUnpaid?.dueOn).toBe("2026-04-10");
  });

  it("keeps an overdue member owing the same months", () => {
    const m = membership();
    const plan = planReset("m1", m, [pay(60000)])!;
    expect(plan.dueChanges).toEqual([{ from_period: 0, due_on: "2026-02-10" }]);
    const restarted = membership({
      dueChanges: [{ fromPeriod: 0, dueOn: "2026-02-10" }],
    });
    // Feb and Mar unpaid on 20 Mar, before and after.
    expect(buildLedger(restarted, [], "2026-03-20").owedPaise).toBe(120000);
  });

  it("keeps dates pushed back by an earlier freeze", () => {
    const m = membership({
      freezes: [{ startsOn: "2026-02-01", endsOn: "2026-02-10" }],
    });
    const plan = planReset("m1", m, [pay(120000)])!;
    // Feb's due date moved 10 days by the freeze; March's too.
    expect(plan.shift).toBe(2);
    expect(scheduleDifferences(m, plan)).toEqual([]);
  });

  it("carries later due-date changes along", () => {
    const m = membership({
      dueChanges: [{ fromPeriod: 4, dueOn: "2026-05-20" }],
    });
    const plan = planReset("m1", m, [pay(120000)])!;
    expect(plan.dueChanges).toEqual([
      { from_period: 0, due_on: "2026-03-10" },
      { from_period: 2, due_on: "2026-05-20" },
    ]);
    expect(scheduleDifferences(m, plan)).toEqual([]);
  });

  it("leaves a member frozen until further notice frozen", () => {
    const m = membership({
      freezes: [{ startsOn: "2026-02-01", endsOn: null }],
    });
    const plan = planReset("m1", m, [pay(60000)])!;
    expect(plan.dueChanges).toEqual([{ from_period: 0, due_on: "2026-02-01" }]);
    const restarted = {
      ...m,
      dueChanges: [{ fromPeriod: 0, dueOn: "2026-02-01" }],
    };
    const ledger = buildLedger(restarted, [], "2026-03-20");
    expect(ledger.owedPaise).toBe(0);
    expect(ledger.periods).toEqual([]);
  });
});
