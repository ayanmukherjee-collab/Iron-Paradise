import { describe, expect, it } from "vitest";
import type { FeeChange, Freeze } from "@/members/billing";
import {
  buildLedger,
  payablePeriods,
  reschedulablePeriod,
  type LedgerPayment,
  type MembershipWithFees,
} from "@/payments/ledger";

const fee = (feePaise: number, effectiveFrom: string): FeeChange => ({
  feePaise,
  effectiveFrom,
  createdAt: new Date(`${effectiveFrom}T00:00:00Z`),
});

let order = 0;
/** A payment for `months` months from `firstPeriod`; the amount is a record. */
const pay = (
  firstPeriod: number,
  months = 1,
  amountPaise = 1000,
): LedgerPayment => ({
  id: `payment-${order}`,
  firstPeriod,
  months,
  amountPaise,
  createdAt: new Date(Date.UTC(2026, 0, 1, 0, 0, order++)),
});

function membership(
  overrides: Partial<MembershipWithFees> = {},
): MembershipWithFees {
  const startsOn = overrides.startsOn ?? "2026-03-12";
  return {
    startsOn,
    // Unpaid, or first paid on the joining day, unless a test says otherwise.
    billingStartsOn: startsOn,
    dueChanges: [],
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
    const paidUp = [pay(0)];
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

describe("periods follow the first payment once there is one", () => {
  // Joined 6 Jan, first paid 8 Jan: the database sets billingStartsOn to the
  // 8th, and every fee after that falls due on the 8th.
  const joinedJan6PaidJan8 = membership({
    startsOn: "2026-01-06",
    billingStartsOn: "2026-01-08",
    fees: [fee(60000, "2026-01-06")],
  });

  it("puts the first payment on period 0 and the next fee on the 8th", () => {
    const ledger = buildLedger(joinedJan6PaidJan8, [pay(0)], "2026-01-08");
    expect(summary(ledger)).toEqual([
      "2026-01-08 60000/60000 paid",
      "2026-02-08 0/60000 upcoming",
    ]);
    expect(ledger.nextUnpaid?.dueOn).toBe("2026-02-08");
    expect(ledger.standing).toBe("paid");
  });

  it("is not due on the 6th of later months", () => {
    const paid = [pay(0)];
    expect(buildLedger(joinedJan6PaidJan8, paid, "2026-02-06").standing).toBe(
      "due",
    );
    expect(buildLedger(joinedJan6PaidJan8, paid, "2026-02-08").standing).toBe(
      "due",
    );
    expect(buildLedger(joinedJan6PaidJan8, paid, "2026-02-09").standing).toBe(
      "overdue",
    );
    expect(buildLedger(joinedJan6PaidJan8, paid, "2026-02-04").standing).toBe(
      "paid",
    );
  });
});

describe("a payment pays for whole months", () => {
  it("pays for one month whatever the amount", () => {
    const ledger = buildLedger(membership(), [pay(0, 1, 30000)], "2026-03-20");
    expect(ledger.periods[0]).toMatchObject({
      paidPaise: 60000,
      status: "paid",
    });
    expect(ledger.owedPaise).toBe(0);
    expect(ledger.nextUnpaid?.dueOn).toBe("2026-04-12");
    expect(ledger.standing).toBe("paid");
  });

  it("pays ahead for later months, even ones not yet due", () => {
    const ledger = buildLedger(membership(), [pay(0, 3, 150000)], "2026-03-20");
    expect(summary(ledger)).toEqual([
      "2026-03-12 60000/60000 paid",
      "2026-04-12 60000/60000 paid",
      "2026-05-12 60000/60000 paid",
      "2026-06-12 0/60000 upcoming",
    ]);
    expect(ledger.owedPaise).toBe(0);
    expect(ledger.standing).toBe("paid");
    expect(ledger.nextUnpaid?.dueOn).toBe("2026-06-12");
  });

  it("starts where the payment says, leaving older debt in place", () => {
    const ledger = buildLedger(membership(), [pay(1)], "2026-04-20");
    expect(summary(ledger).slice(0, 2)).toEqual([
      "2026-03-12 0/60000 overdue",
      "2026-04-12 60000/60000 paid",
    ]);
    expect(ledger.nextUnpaid?.dueOn).toBe("2026-03-12");
  });

  it("pays a month once, however many payments cover it", () => {
    const ledger = buildLedger(membership(), [pay(0), pay(0)], "2026-03-20");
    expect(ledger.periods[1]).toMatchObject({
      dueOn: "2026-04-12",
      status: "upcoming",
    });
  });

  it("does not depend on the order payments are listed in", () => {
    const first = pay(0, 1);
    const second = pay(1, 3);
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
      [pay(0, 3)],
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

  it("lets a free member's payment count for nothing owed", () => {
    const ledger = buildLedger(
      membership({ fees: [fee(0, "2026-03-12")] }),
      [pay(0)],
      "2026-04-01",
    );
    expect(ledger.owedPaise).toBe(0);
    expect(ledger.standing).toBe("free");
  });
});

describe("freezes and leaving", () => {
  const tenDays: Freeze = { startsOn: "2026-04-01", endsOn: "2026-04-10" };

  it("moves due dates back by the length of a freeze", () => {
    const ledger = buildLedger(
      membership({ freezes: [tenDays] }),
      [pay(0)],
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
      [pay(0, 2)],
      "2026-09-01",
    );
    expect(summary(ledger)).toEqual(["2026-03-12 60000/60000 paid"]);
    // The second month is paid as soon as the freeze ends.
    expect(ledger.creditMonths).toBe(1);
    expect(ledger.standing).toBe("paid");
  });

  it("stops billing when a membership ends, keeping earlier debt", () => {
    const ledger = buildLedger(
      membership({ endedOn: "2026-05-12" }),
      [pay(0)],
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
      [pay(0), pay(2)],
      "2026-04-20",
      2,
    );
    expect(periods.map((p) => `${p.index} ${p.dueOn}`)).toEqual([
      "1 2026-04-12",
      "3 2026-06-12",
      "4 2026-07-12",
      "5 2026-08-12",
    ]);
  });

  it("records which periods each payment pays for", () => {
    const first = pay(0, 1);
    const second = pay(0, 2);
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

describe("which month a due-date change moves", () => {
  // Dues on the 12th from 12 Mar, ₹600 a month.
  const today = "2026-05-20";
  const moved = (payments: LedgerPayment[], m = membership()) =>
    reschedulablePeriod(buildLedger(m, payments, today), today);

  it("moves the oldest month not paid, owed months included", () => {
    // March paid; April and May owed: April moves (with May after it).
    expect(moved([pay(0)])).toBe(1);
  });

  it("moves the month after everything paid ahead", () => {
    expect(moved([pay(0, 5)])).toBe(5);
  });

  it("moves the next month that falls due for a free member", () => {
    const free = membership({ fees: [fee(0, "2026-03-12")] });
    // 12 May has passed; 12 Jun (period 3) is next.
    expect(moved([], free)).toBe(3);
  });

  it("moves period 0 before the first payment", () => {
    expect(moved([])).toBe(0);
  });
});

describe("periods follow a moved due date", () => {
  it("bills owed months on the new day and keeps paid months as they were", () => {
    // March paid on the 12th; April onwards moved to the 20th.
    const m = membership({
      dueChanges: [{ fromPeriod: 1, dueOn: "2026-04-20" }],
    });
    const ledger = buildLedger(m, [pay(0)], "2026-04-25");
    expect(
      ledger.periods.map((p) => `${p.index} ${p.dueOn} ${p.status}`),
    ).toEqual([
      "0 2026-03-12 paid",
      "1 2026-04-20 overdue",
      "2 2026-05-20 upcoming",
    ]);
    expect(ledger.owedPaise).toBe(60000);
  });

  it("charges the first fee for months moved before the joining day", () => {
    const m = membership({
      dueChanges: [{ fromPeriod: 0, dueOn: "2026-02-01" }],
    });
    const ledger = buildLedger(m, [], "2026-02-01");
    expect(ledger.periods[0]).toMatchObject({
      dueOn: "2026-02-01",
      feePaise: 60000,
      status: "due",
    });
  });
});
