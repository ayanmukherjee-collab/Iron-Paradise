import { describe, expect, it } from "vitest";
import {
  buildLedger,
  payablePeriods,
  type MembershipWithFees,
} from "@/payments/ledger";
import { firstPaymentNextDue, planQuote } from "@/payments/plan-quote";

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

describe("planQuote", () => {
  it("prices the next three months and moves the due date three months on", () => {
    const payments = [
      { id: "a", firstPeriod: 0, amountPaise: 60000, createdAt: new Date(0) },
    ];
    const periods = payablePeriods(membership, payments, "2026-02-12", 24);
    const quote = planQuote(periods, periods[0].index, 3)!;
    expect(quote).toEqual({
      amountPaise: 180000,
      lastPaidDueOn: "2026-04-10",
      nextDueOn: "2026-05-10",
    });

    // Recording exactly that amount leaves May as the next month to pay.
    const after = [
      ...payments,
      {
        id: "b",
        firstPeriod: periods[0].index,
        amountPaise: quote.amountPaise,
        createdAt: new Date(1),
      },
    ];
    const ledger = buildLedger(membership, after, "2026-02-12");
    expect(payablePeriods(membership, after, "2026-02-12")[0].dueOn).toBe(
      "2026-05-10",
    );
    expect(ledger.owedPaise).toBe(0);
  });

  it("only charges what's left on a part-paid month", () => {
    const payments = [
      { id: "a", firstPeriod: 0, amountPaise: 20000, createdAt: new Date(0) },
    ];
    const periods = payablePeriods(membership, payments, "2026-01-12", 24);
    expect(planQuote(periods, 0, 2)?.amountPaise).toBe(40000 + 60000);
  });

  it("refuses when the list is too short or the start isn't in it", () => {
    const periods = payablePeriods(membership, [], "2026-01-12", 2);
    expect(planQuote(periods, 0, 12)).toBeNull();
    expect(planQuote(periods, 99, 1)).toBeNull();
  });
});

describe("firstPaymentNextDue", () => {
  it("counts months from the day the dues start, clamped to month end", () => {
    expect(firstPaymentNextDue("2026-11-30", 3)).toBe("2027-02-28");
  });
});
