import { describe, expect, it } from "vitest";
import {
  buildLedger,
  payablePeriods,
  type MembershipWithFees,
} from "@/payments/ledger";
import { firstPaymentNextDue, nextDueAfter } from "@/payments/plan-quote";

const membership: MembershipWithFees = {
  startsOn: "2026-01-10",
  endedOn: null,
  billingStartsOn: "2026-01-10",
  dueChanges: [],
  freezes: [],
  fees: [
    { feePaise: 60000, effectiveFrom: "2026-01-10", createdAt: new Date(0) },
  ],
};

describe("nextDueAfter", () => {
  it("moves the due date three months on for a three-month payment", () => {
    const payments = [
      {
        id: "a",
        firstPeriod: 0,
        months: 1,
        amountPaise: 60000,
        createdAt: new Date(0),
      },
    ];
    const periods = payablePeriods(membership, payments, "2026-02-12", 24);
    expect(nextDueAfter(periods, periods[0].index, 3)).toBe("2026-05-10");

    // Recording it, for any amount, leaves May as the next month to pay.
    const after = [
      ...payments,
      {
        id: "b",
        firstPeriod: periods[0].index,
        months: 3,
        amountPaise: 150000,
        createdAt: new Date(1),
      },
    ];
    const ledger = buildLedger(membership, after, "2026-02-12");
    expect(payablePeriods(membership, after, "2026-02-12")[0].dueOn).toBe(
      "2026-05-10",
    );
    expect(ledger.owedPaise).toBe(0);
  });

  it("says nothing when the list doesn't reach that far", () => {
    const periods = payablePeriods(membership, [], "2026-01-12", 2);
    expect(nextDueAfter(periods, 0, 12)).toBeNull();
  });
});

describe("firstPaymentNextDue", () => {
  it("counts months from the day the dues start, clamped to month end", () => {
    expect(firstPaymentNextDue("2026-11-30", 3)).toBe("2027-02-28");
  });
});
