import { describe, expect, it } from "vitest";
import {
  buildLedger,
  type LedgerPayment,
  type MembershipWithFees,
} from "@/payments/ledger";
import {
  nextYearClose,
  planCarries,
  sameLedger,
  yearCloseCutoff,
  type ClosePayment,
} from "@/payments/year-close";

describe("yearCloseCutoff", () => {
  it("is the start of the previous financial year", () => {
    expect(yearCloseCutoff("2028-04-01")).toBe("2027-04-01");
    expect(yearCloseCutoff("2028-04-07")).toBe("2027-04-01");
    expect(yearCloseCutoff("2028-03-31")).toBe("2026-04-01");
    expect(yearCloseCutoff("2026-11-18")).toBe("2025-04-01");
  });

  it("names the next close and what it removes", () => {
    expect(nextYearClose("2026-11-18")).toEqual({
      on: "2027-04-01",
      cutoff: "2026-04-01",
    });
    expect(nextYearClose("2027-04-01")).toEqual({
      on: "2028-04-01",
      cutoff: "2027-04-01",
    });
  });
});

const membership: MembershipWithFees = {
  startsOn: "2025-01-10",
  endedOn: null,
  billingStartsOn: "2025-01-10",
  dueChanges: [],
  freezes: [],
  fees: [
    { feePaise: 60000, effectiveFrom: "2025-01-10", createdAt: new Date(0) },
    { feePaise: 80000, effectiveFrom: "2025-06-10", createdAt: new Date(1) },
  ],
};
const today = "2026-11-18";
const cutoff = yearCloseCutoff(today); // 2025-04-01

let sequence = 0;
/** A payment for `months` months from `firstPeriod`, ₹500 a month paid. */
function pay(
  firstPeriod: number,
  months: number,
  paidOn: string,
  extra: Partial<ClosePayment> = {},
): ClosePayment {
  sequence += 1;
  return {
    id: `p${sequence}`,
    membershipId: "m1",
    firstPeriod,
    months,
    amountPaise: months * 50000,
    paidOn,
    createdAt: new Date(Date.parse(`${paidOn}T10:00:00Z`) + sequence),
    voided: false,
    replacesPaymentId: null,
    ...extra,
  };
}

/** The ledger after applying a plan, the way the database will. */
function ledgerAfter(payments: ClosePayment[]) {
  const [plan] = planCarries(payments, cutoff);
  const gone = new Set(plan?.deleteIds ?? []);
  const remaining: LedgerPayment[] = [
    ...(plan?.carry ?? []).map((entry, i) => ({
      id: `c${i}`,
      firstPeriod: entry.firstPeriod,
      months: entry.months,
      amountPaise: entry.amountPaise,
      createdAt: new Date(0),
    })),
    ...payments.filter((p) => !p.voided && !gone.has(p.id)),
  ];
  return { plan, ledger: buildLedger(membership, remaining, today) };
}

const ledgerOf = (payments: ClosePayment[]) =>
  buildLedger(
    membership,
    payments.filter((p) => !p.voided),
    today,
  );

const money = (payments: ClosePayment[]) =>
  payments.reduce((sum, p) => sum + p.amountPaise, 0);

describe("planCarries", () => {
  it("merges an unbroken run of old payments into one entry", () => {
    const payments = [
      pay(0, 1, "2025-01-10"),
      pay(1, 1, "2025-02-11"),
      pay(2, 1, "2025-03-10"),
      pay(3, 1, "2025-04-10"),
      pay(4, 1, "2025-05-12"),
    ];
    const { plan, ledger } = ledgerAfter(payments);
    expect(plan.deleteIds).toEqual(["p1", "p2", "p3"]);
    expect(plan.carry).toEqual([
      { firstPeriod: 0, months: 3, amountPaise: 150000 },
    ]);
    expect(sameLedger(ledger, ledgerOf(payments))).toBe(true);
  });

  it("keeps a separate entry for each run, so an unpaid month stays unpaid", () => {
    sequence = 100;
    const payments = [pay(0, 1, "2025-01-10"), pay(2, 1, "2025-03-10")];
    const { plan, ledger } = ledgerAfter(payments);
    expect(plan.carry).toEqual([
      { firstPeriod: 0, months: 1, amountPaise: 50000 },
      { firstPeriod: 2, months: 1, amountPaise: 50000 },
    ]);
    expect(sameLedger(ledger, ledgerOf(payments))).toBe(true);
  });

  it("merges overlapping payments, money and all", () => {
    sequence = 150;
    const payments = [pay(0, 3, "2025-01-10"), pay(1, 1, "2025-02-11")];
    const { plan, ledger } = ledgerAfter(payments);
    expect(plan.carry).toEqual([
      { firstPeriod: 0, months: 3, amountPaise: 200000 },
    ]);
    expect(sameLedger(ledger, ledgerOf(payments))).toBe(true);
  });

  it("drops voided payments without carrying them", () => {
    sequence = 200;
    const payments = [
      pay(0, 1, "2025-01-10"),
      pay(1, 2, "2025-02-11", { voided: true }),
    ];
    const { plan, ledger } = ledgerAfter(payments);
    expect(plan.deleteIds.sort()).toEqual(["p201", "p202"]);
    expect(plan.carry).toEqual([
      { firstPeriod: 0, months: 1, amountPaise: 50000 },
    ]);
    expect(sameLedger(ledger, ledgerOf(payments))).toBe(true);
  });

  it("keeps the whole chain behind a correction that stays", () => {
    sequence = 300;
    const first = pay(1, 1, "2025-02-11", { voided: true });
    const second = pay(1, 1, "2025-02-12", {
      voided: true,
      replacesPaymentId: first.id,
    });
    const third = pay(1, 1, "2025-05-01", {
      replacesPaymentId: second.id,
    });
    const payments = [pay(0, 1, "2025-01-10"), first, second, third];
    const { plan, ledger } = ledgerAfter(payments);
    // Only the plain January payment goes; the chain of corrections stays.
    expect(plan.deleteIds).toEqual(["p304"]);
    expect(sameLedger(ledger, ledgerOf(payments))).toBe(true);
  });

  it("leaves memberships with nothing old alone", () => {
    sequence = 400;
    expect(planCarries([pay(5, 1, "2025-06-10")], cutoff)).toEqual([]);
  });

  it("never changes a ledger or loses money, over many random histories", () => {
    let seed = 7;
    const random = () => {
      seed = (seed * 1103515245 + 12345) % 2 ** 31;
      return seed / 2 ** 31;
    };
    for (let run = 0; run < 300; run++) {
      sequence = 1000 + run * 50;
      const payments: ClosePayment[] = [];
      let day = Date.parse("2025-01-10");
      for (let i = 0; i < 2 + Math.floor(random() * 10); i++) {
        day += Math.floor(random() * 40) * 86_400_000;
        const paidOn = new Date(day).toISOString().slice(0, 10);
        payments.push(
          pay(
            Math.floor(random() * 8),
            [1, 1, 3, 6, 12][Math.floor(random() * 5)],
            paidOn,
            { voided: random() < 0.1 },
          ),
        );
      }
      const { plan, ledger } = ledgerAfter(payments);
      expect(sameLedger(ledger, ledgerOf(payments))).toBe(true);
      if (plan) {
        const leaving = payments.filter(
          (p) => plan.deleteIds.includes(p.id) && !p.voided,
        );
        expect(
          plan.carry.reduce((sum, entry) => sum + entry.amountPaise, 0),
        ).toBe(money(leaving));
      }
    }
  });
});
