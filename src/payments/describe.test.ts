import { describe, expect, it } from "vitest";
import { describeRecordedPayment } from "@/payments/describe";
import { buildLedger, type MembershipWithFees } from "@/payments/ledger";

const membership: MembershipWithFees = {
  startsOn: "2026-03-12",
  endedOn: null,
  freezes: [],
  fees: [
    { feePaise: 60000, effectiveFrom: "2026-03-12", createdAt: new Date(0) },
  ],
};

function messageFor(amountPaise: number, startsAt = 0) {
  const ledger = buildLedger(
    membership,
    [{ id: "new", amountPaise, firstPeriod: startsAt, createdAt: new Date() }],
    "2026-03-20",
  );
  return describeRecordedPayment(ledger, "new", amountPaise);
}

describe("the message after recording a payment", () => {
  it("names the single month a full fee paid for", () => {
    expect(messageFor(60000)).toBe("Recorded ₹600 for 12 Mar 2026.");
  });

  it("says how much is still due after a partial payment", () => {
    expect(messageFor(40000)).toBe(
      "Recorded ₹400 for 12 Mar 2026. ₹200 is still due for 12 Mar 2026.",
    );
  });

  it("gives the range an advance covers", () => {
    expect(messageFor(180000)).toBe(
      "Recorded ₹1,800, covering 12 Mar 2026 to 12 May 2026.",
    );
  });
});
