import { describe, expect, it } from "vitest";
import { describeRecordedPayment } from "@/payments/describe";
import { buildLedger, type MembershipWithFees } from "@/payments/ledger";

const membership: MembershipWithFees = {
  startsOn: "2026-03-12",
  billingStartsOn: "2026-03-12",
  dueChanges: [],
  endedOn: null,
  freezes: [],
  fees: [
    { feePaise: 60000, effectiveFrom: "2026-03-12", createdAt: new Date(0) },
  ],
};

function messageFor(amountPaise: number, months: number, startsAt = 0) {
  const ledger = buildLedger(
    membership,
    [
      {
        id: "new",
        firstPeriod: startsAt,
        months,
        amountPaise,
        createdAt: new Date(),
      },
    ],
    "2026-03-20",
  );
  return describeRecordedPayment(ledger, "new", amountPaise);
}

describe("the message after recording a payment", () => {
  it("names the month paid for and the next due date", () => {
    expect(messageFor(60000, 1)).toBe(
      "Recorded ₹600 for 12 Mar 2026. Next due 12 Apr 2026.",
    );
  });

  it("takes the amount as given: a smaller sum still pays the month", () => {
    expect(messageFor(40000, 1)).toBe(
      "Recorded ₹400 for 12 Mar 2026. Next due 12 Apr 2026.",
    );
  });

  it("gives the range a longer plan covers", () => {
    expect(messageFor(170000, 3)).toBe(
      "Recorded ₹1,700, covering 12 Mar 2026 to 12 May 2026. Next due 12 Jun 2026.",
    );
  });
});
