import { describe, expect, it } from "vitest";
import type { FeeChange } from "@/members/billing";
import { buildLedger, type MembershipWithFees } from "@/payments/ledger";
import {
  monthRange,
  sheetMonths,
  sheetRow,
  type MembershipLedger,
} from "@/payments/sheet";

const fee = (feePaise: number, effectiveFrom: string): FeeChange => ({
  feePaise,
  effectiveFrom,
  createdAt: new Date(`${effectiveFrom}T00:00:00Z`),
});

function withLedger(
  facts: MembershipWithFees,
  paid: number[],
  today: string,
): MembershipLedger {
  return {
    membershipId: "m1",
    startsOn: facts.startsOn,
    endedOn: facts.endedOn,
    freezes: facts.freezes,
    ledger: buildLedger(
      facts,
      paid.map((amountPaise, index) => ({
        id: `payment-${index}`,
        amountPaise,
        firstPeriod: 0,
        createdAt: new Date(index),
      })),
      today,
    ),
  };
}

const base: MembershipWithFees = {
  startsOn: "2026-03-12",
  billingStartsOn: "2026-03-12",
  endedOn: null,
  freezes: [],
  fees: [fee(60000, "2026-03-12")],
};

describe("month columns", () => {
  it("ends next month by default and refuses months beyond it", () => {
    expect(sheetMonths(null, "2026-11-15").at(-1)).toBe("2026-12");
    expect(sheetMonths("2027-05", "2026-11-15").at(-1)).toBe("2026-12");
    expect(sheetMonths("2026-13", "2026-11-15").at(-1)).toBe("2026-12");
    expect(sheetMonths("2026-03", "2026-11-15")).toEqual([
      "2025-09",
      "2025-10",
      "2025-11",
      "2025-12",
      "2026-01",
      "2026-02",
      "2026-03",
    ]);
  });

  it("counts back across a year end", () => {
    expect(monthRange("2027-02", 4)).toEqual([
      "2026-11",
      "2026-12",
      "2027-01",
      "2027-02",
    ]);
  });
});

describe("sheet cells", () => {
  it("shows paid, partial, overdue and upcoming months", () => {
    const row = sheetRow(
      [withLedger(base, [90000], "2026-05-20")],
      ["2026-02", "2026-03", "2026-04", "2026-05", "2026-06"],
    );
    expect(Object.values(row).map((cell) => cell.status)).toEqual([
      "none",
      "paid",
      "partial",
      "overdue",
      "upcoming",
    ]);
    expect(row["2026-04"]).toMatchObject({
      paidPaise: 30000,
      feePaise: 60000,
      target: { membershipId: "m1", period: 1 },
    });
    expect(row["2026-03"].target).toBeNull();
  });

  it("marks months swallowed by a freeze as frozen", () => {
    const frozen = {
      ...base,
      freezes: [{ startsOn: "2026-04-01", endsOn: null }],
    };
    const row = sheetRow(
      [withLedger(frozen, [60000], "2026-06-01")],
      ["2026-03", "2026-04", "2026-05"],
    );
    expect(Object.values(row).map((cell) => cell.status)).toEqual([
      "paid",
      "frozen",
      "frozen",
    ]);
  });

  it("shows free months for free members", () => {
    const row = sheetRow(
      [withLedger({ ...base, fees: [fee(0, "2026-03-12")] }, [], "2026-04-20")],
      ["2026-04"],
    );
    expect(row["2026-04"].status).toBe("free");
  });

  it("combines two periods that land in the same month", () => {
    // A 26-day freeze from 3 Feb moves the 3 Feb and 3 Mar dues to 1 Mar
    // and 29 Mar.
    const facts: MembershipWithFees = {
      startsOn: "2026-01-03",
      billingStartsOn: "2026-01-03",
      endedOn: null,
      freezes: [{ startsOn: "2026-02-03", endsOn: "2026-02-28" }],
      fees: [fee(60000, "2026-01-03")],
    };
    // ₹1,800 pays the 3 Jan due and both March dues.
    const row = sheetRow(
      [withLedger(facts, [180000], "2026-04-10")],
      ["2026-02", "2026-03"],
    );
    expect(row["2026-02"].status).toBe("frozen");
    expect(row["2026-03"]).toMatchObject({
      status: "paid",
      paidPaise: 120000,
      feePaise: 120000,
    });
  });
});
