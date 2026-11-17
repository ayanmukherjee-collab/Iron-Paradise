import { describe, expect, it } from "vitest";
import type { FeeChange } from "@/members/billing";
import {
  buildLedger,
  type LedgerPayment,
  type MembershipWithFees,
} from "@/payments/ledger";
import { reminderFor, stageOn } from "@/notifications/schedule";

const fee = (feePaise: number, effectiveFrom: string): FeeChange => ({
  feePaise,
  effectiveFrom,
  createdAt: new Date(`${effectiveFrom}T00:00:00Z`),
});

const pay = (amountPaise: number, firstPeriod: number): LedgerPayment => ({
  id: `payment-${firstPeriod}-${amountPaise}`,
  amountPaise,
  firstPeriod,
  createdAt: new Date("2026-01-01T00:00:00Z"),
});

// Joined 12 March at ₹600, paid March and April: May's fee is next.
const membership: MembershipWithFees = {
  startsOn: "2026-03-12",
  billingStartsOn: "2026-03-12",
  dueChanges: [],
  endedOn: null,
  freezes: [],
  fees: [fee(60000, "2026-03-12")],
};
const paidTwoMonths = [pay(120000, 0)];

function remind(
  today: string,
  payments = paidTwoMonths,
  mode: "automatic" | "staff" = "automatic",
) {
  return reminderFor(buildLedger(membership, payments, today), today, mode);
}

describe("the daily job's three reminders", () => {
  it.each([
    ["2026-05-08", null],
    ["2026-05-09", "due_soon"],
    ["2026-05-11", "due_soon"],
    ["2026-05-12", "due_today"],
    ["2026-05-13", null],
    ["2026-05-14", null],
    ["2026-05-15", "overdue"],
    // A few days' grace in case a morning run was missed...
    ["2026-05-19", "overdue"],
    // ...but old debts are left to staff.
    ["2026-05-20", null],
  ])("on %s sends %s", (today, stage) => {
    expect(remind(today)?.stage ?? null).toBe(stage);
  });

  it("names the fee and the amount", () => {
    expect(remind("2026-05-09")).toEqual({
      stage: "due_soon",
      period: 2,
      dueOn: "2026-05-12",
      unpaidSince: "2026-05-12",
      amountPaise: 60000,
    });
  });

  it("stops once the fee is paid", () => {
    expect(remind("2026-05-12", [pay(180000, 0)])).toBeNull();
    expect(remind("2026-05-15", [pay(180000, 0)])).toBeNull();
  });

  it("asks only for what is left after a partial payment", () => {
    expect(
      remind("2026-05-12", [...paidTwoMonths, pay(20000, 2)])?.amountPaise,
    ).toBe(40000);
  });

  it("sends nothing to free members", () => {
    const free = { ...membership, fees: [fee(0, "2026-03-12")] };
    expect(
      reminderFor(
        buildLedger(free, [], "2026-05-12"),
        "2026-05-12",
        "automatic",
      ),
    ).toBeNull();
  });
});

describe("the staff WhatsApp queue", () => {
  it("offers overdue fees however old, with the full amount owed", () => {
    expect(remind("2026-07-01", paidTwoMonths, "staff")).toEqual({
      stage: "overdue",
      period: 3,
      dueOn: "2026-06-12",
      unpaidSince: "2026-05-12",
      amountPaise: 120000,
    });
  });

  it("chooses the coming fee when one is also due soon, and includes the debt", () => {
    expect(remind("2026-06-10", paidTwoMonths, "staff")).toMatchObject({
      stage: "due_soon",
      dueOn: "2026-06-12",
      unpaidSince: "2026-05-12",
      amountPaise: 120000,
    });
  });

  it("offers nothing to a member who is paid up", () => {
    expect(remind("2026-05-01", paidTwoMonths, "staff")).toBeNull();
  });
});

describe("stageOn", () => {
  it("never calls a payment due more than 3 days ahead", () => {
    expect(stageOn("2026-05-12", "2026-05-08", "staff")).toBeNull();
  });
});

describe("a late payment never moves the due date", () => {
  // Joined and first paid on 6 Jan; paid February's fee late, on 8 Feb. Only
  // the first payment sets the due day, not each later one, so March is
  // still due on the 6th and the reminders say so.
  const joinedJan6: MembershipWithFees = {
    startsOn: "2026-01-06",
    billingStartsOn: "2026-01-06",
    dueChanges: [],
    endedOn: null,
    freezes: [],
    fees: [fee(60000, "2026-01-06")],
  };
  const janAndFeb = [pay(60000, 0), pay(60000, 1)];

  it("keeps the next due date on the 6th", () => {
    const ledger = buildLedger(joinedJan6, janAndFeb, "2026-02-08");
    expect(ledger.nextUnpaid?.dueOn).toBe("2026-03-06");
    expect(ledger.standing).toBe("paid");
  });

  it("reminds for 6 March: 3 days before, on the day, 3 days after", () => {
    for (const [today, stage] of [
      ["2026-03-03", "due_soon"],
      ["2026-03-06", "due_today"],
      ["2026-03-09", "overdue"],
    ] as const) {
      const ledger = buildLedger(joinedJan6, janAndFeb, today);
      expect(reminderFor(ledger, today, "automatic")).toMatchObject({
        stage,
        dueOn: "2026-03-06",
      });
    }
  });
});
