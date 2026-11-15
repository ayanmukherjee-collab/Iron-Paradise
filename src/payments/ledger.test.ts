import { describe, expect, it } from "vitest";
import type { FeeChange, Freeze } from "@/members/billing";
import {
  buildLedger,
  payablePeriods,
  type LedgerPayment,
  type MembershipWithFees,
} from "@/payments/ledger";

const fee = (feePaise: number, effectiveFrom: string): FeeChange => ({
  feePaise,
  effectiveFrom,
  createdAt: new Date(`${effectiveFrom}T00:00:00Z`),
});

let order = 0;
const pay = (amountPaise: number, firstPeriod: number): LedgerPayment => ({
  id: `payment-${order}`,
  amountPaise,
  firstPeriod,
  createdAt: new Date(Date.UTC(2026, 0, 1, 0, 0, order++)),
});

function membership(
  overrides: Partial<MembershipWithFees> = {},
): MembershipWithFees {
  return {
    startsOn: "2026-03-12",
    endedOn: null,
    freezes: [],
    fees: [fee(60000, "2026-03-12")],
    ...overrides,
  };
}

const summary = (ledger: ReturnType<typeof buildLedger>) =>
  ledger.periods.map(
    (p) => `${p.dueOn} ${p.paidPaise}/${p.feePaise} ${p.status}`,
  );

describe("periods follow the joining date", () => {
  it("lists every period due so far plus the next one", () => {
    const ledger = buildLedger(membership(), [], "2026-05-20");
    expect(summary(ledger)).toEqual([
      "2026-03-12 0/60000 overdue",
      "2026-04-12 0/60000 overdue",
      "2026-05-12 0/60000 overdue",
      "2026-06-12 0/60000 upcoming",
    ]);
    expect(ledger.owedPaise).toBe(180000);
    expect(ledger.standing).toBe("overdue");
  });

  it("calls a period due from three days before until its due date", () => {
    const paidUp = [pay(60000, 0)];
    expect(buildLedger(membership(), paidUp, "2026-04-08").standing).toBe(
      "paid",
    );
    expect(buildLedger(membership(), paidUp, "2026-04-09").standing).toBe(
      "due",
    );
    expect(buildLedger(membership(), paidUp, "2026-04-12").standing).toBe(
      "due",
    );
    expect(buildLedger(membership(), paidUp, "2026-04-13").standing).toBe(
      "overdue",
    );
  });

  it("uses month ends for members who joined on the 31st", () => {
    const ledger = buildLedger(
      membership({ startsOn: "2026-01-31", fees: [fee(50000, "2026-01-31")] }),
      [],
      "2026-03-01",
    );
    expect(ledger.periods.map((p) => p.dueOn)).toEqual([
      "2026-01-31",
      "2026-02-28",
      "2026-03-31",
    ]);
  });
});

describe("payments fill periods in order", () => {
  it("marks a short payment as partial", () => {
    const ledger = buildLedger(membership(), [pay(30000, 0)], "2026-03-20");
    expect(ledger.periods[0]).toMatchObject({
      paidPaise: 30000,
      status: "partial",
    });
    expect(ledger.owedPaise).toBe(30000);
    expect(ledger.nextUnpaid?.dueOn).toBe("2026-03-12");
    expect(ledger.standing).toBe("overdue");
  });

  it("carries an advance across later periods, even ones not yet due", () => {
    const ledger = buildLedger(membership(), [pay(200000, 0)], "2026-03-20");
    expect(summary(ledger)).toEqual([
      "2026-03-12 60000/60000 paid",
      "2026-04-12 60000/60000 paid",
      "2026-05-12 60000/60000 paid",
      "2026-06-12 20000/60000 partial",
    ]);
    expect(ledger.owedPaise).toBe(0);
    expect(ledger.standing).toBe("paid");
    expect(ledger.nextUnpaid?.dueOn).toBe("2026-06-12");
  });

  it("tops up a partial period before moving on", () => {
    const ledger = buildLedger(
      membership(),
      [pay(30000, 0), pay(60000, 0)],
      "2026-04-01",
    );
    expect(summary(ledger).slice(0, 2)).toEqual([
      "2026-03-12 60000/60000 paid",
      "2026-04-12 30000/60000 partial",
    ]);
  });

  it("starts where the payment says, leaving older debt in place", () => {
    const ledger = buildLedger(membership(), [pay(60000, 1)], "2026-04-20");
    expect(summary(ledger).slice(0, 2)).toEqual([
      "2026-03-12 0/60000 overdue",
      "2026-04-12 60000/60000 paid",
    ]);
    expect(ledger.nextUnpaid?.dueOn).toBe("2026-03-12");
  });

  it("skips periods that are already paid", () => {
    const ledger = buildLedger(
      membership(),
      [pay(60000, 0), pay(60000, 0)],
      "2026-03-20",
    );
    expect(ledger.periods[1]).toMatchObject({
      dueOn: "2026-04-12",
      status: "paid",
    });
  });

  it("does not depend on the order payments are listed in", () => {
    const first = pay(30000, 0);
    const second = pay(90000, 0);
    expect(
      summary(buildLedger(membership(), [second, first], "2026-05-01")),
    ).toEqual(
      summary(buildLedger(membership(), [first, second], "2026-05-01")),
    );
  });
});

describe("fees are per member and change from a due date", () => {
  it("charges each period the fee agreed for its due date", () => {
    const ledger = buildLedger(
      membership({
        fees: [fee(60000, "2026-03-12"), fee(50000, "2026-05-12")],
      }),
      [pay(170000, 0)],
      "2026-05-20",
    );
    expect(summary(ledger)).toEqual([
      "2026-03-12 60000/60000 paid",
      "2026-04-12 60000/60000 paid",
      "2026-05-12 50000/50000 paid",
      "2026-06-12 0/50000 upcoming",
    ]);
  });

  it("never makes a free member due or overdue", () => {
    const ledger = buildLedger(
      membership({ fees: [fee(0, "2026-03-12")] }),
      [],
      "2026-08-01",
    );
    expect(ledger.periods.every((p) => p.status === "free")).toBe(true);
    expect(ledger.owedPaise).toBe(0);
    expect(ledger.standing).toBe("free");
    expect(ledger.nextUnpaid).toBeNull();
  });

  it("keeps old debt after a member becomes free", () => {
    const ledger = buildLedger(
      membership({ fees: [fee(60000, "2026-03-12"), fee(0, "2026-04-12")] }),
      [],
      "2026-05-01",
    );
    expect(ledger.owedPaise).toBe(60000);
    expect(ledger.standing).toBe("overdue");
  });

  it("holds money paid by a free member as credit", () => {
    const ledger = buildLedger(
      membership({ fees: [fee(0, "2026-03-12")] }),
      [pay(10000, 0)],
      "2026-04-01",
    );
    expect(ledger.creditPaise).toBe(10000);
  });
});

describe("freezes and leaving", () => {
  const tenDays: Freeze = { startsOn: "2026-04-01", endsOn: "2026-04-10" };

  it("moves due dates back by the length of a freeze", () => {
    const ledger = buildLedger(
      membership({ freezes: [tenDays] }),
      [pay(60000, 0)],
      "2026-04-20",
    );
    expect(ledger.periods[1]).toMatchObject({
      dueOn: "2026-04-22",
      status: "due",
    });
  });

  it("charges nothing while an open-ended freeze holds", () => {
    const ledger = buildLedger(
      membership({ freezes: [{ startsOn: "2026-04-01", endsOn: null }] }),
      [pay(120000, 0)],
      "2026-09-01",
    );
    expect(summary(ledger)).toEqual(["2026-03-12 60000/60000 paid"]);
    expect(ledger.creditPaise).toBe(60000);
    expect(ledger.standing).toBe("paid");
  });

  it("stops billing when a membership ends, keeping earlier debt", () => {
    const ledger = buildLedger(
      membership({ endedOn: "2026-05-12" }),
      [pay(60000, 0)],
      "2026-09-01",
    );
    expect(ledger.periods.map((p) => p.dueOn)).toEqual([
      "2026-03-12",
      "2026-04-12",
    ]);
    expect(ledger.owedPaise).toBe(60000);
  });
});

describe("choosing where a payment starts", () => {
  it("offers unpaid periods first, then future ones for advances", () => {
    const periods = payablePeriods(
      membership(),
      [pay(60000, 0), pay(30000, 1)],
      "2026-04-20",
      2,
    );
    expect(periods.map((p) => `${p.index} ${p.dueOn} ${p.paidPaise}`)).toEqual([
      "1 2026-04-12 30000",
      "2 2026-05-12 0",
      "3 2026-06-12 0",
      "4 2026-07-12 0",
    ]);
  });

  it("records which periods each payment went towards", () => {
    const first = pay(30000, 0);
    const second = pay(90000, 0);
    const { coverage } = buildLedger(
      membership(),
      [first, second],
      "2026-04-20",
    );
    const span = (id: string) => {
      const { first: from, last: to } = coverage.get(id)!;
      return `${from.dueOn}..${to.dueOn}`;
    };
    expect(span(first.id)).toBe("2026-03-12..2026-03-12");
    expect(span(second.id)).toBe("2026-03-12..2026-04-12");
  });
});
