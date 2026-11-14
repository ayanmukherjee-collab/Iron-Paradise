import { describe, expect, it } from "vitest";
import {
  activeFreeze,
  dueDate,
  feeChangeEffectiveFrom,
  feeOn,
  isGoneQuiet,
  membershipStatus,
  nextDueDate,
  type FeeChange,
  type MembershipFacts,
} from "@/members/billing";
import {
  addMonthsClamped,
  daysBetween,
  isIsoDate,
  todayAtGym,
} from "@/lib/dates";

const fee = (
  feePaise: number,
  effectiveFrom: string,
  createdAt = "2026-01-01T00:00:00Z",
): FeeChange => ({
  feePaise,
  effectiveFrom,
  createdAt: new Date(createdAt),
});

describe("dates", () => {
  it("clamps month arithmetic to the end of shorter months", () => {
    expect(addMonthsClamped("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonthsClamped("2028-01-31", 1)).toBe("2028-02-29");
    expect(addMonthsClamped("2026-01-31", 2)).toBe("2026-03-31");
    expect(addMonthsClamped("2026-12-15", 1)).toBe("2027-01-15");
  });

  it("validates real calendar dates only", () => {
    expect(isIsoDate("2026-02-28")).toBe(true);
    expect(isIsoDate("2026-02-30")).toBe(false);
    expect(isIsoDate("26-2-3")).toBe(false);
  });

  it("uses the gym's calendar day, not UTC", () => {
    // 20:00 UTC on 14 Nov is 01:30 on 15 Nov in India.
    expect(todayAtGym(new Date("2026-11-14T20:00:00Z"))).toBe("2026-11-15");
  });

  it("counts days across months", () => {
    expect(daysBetween("2026-02-25", "2026-03-05")).toBe(8);
  });
});

describe("due dates follow the joining date", () => {
  it("falls due on the same day each month, starting on the joining day", () => {
    expect(
      [0, 1, 2].map((period) => dueDate("2026-03-12", period, [])),
    ).toEqual(["2026-03-12", "2026-04-12", "2026-05-12"]);
  });

  it("moves to the last day of short months and back again after", () => {
    expect(
      [1, 2, 3].map((period) => dueDate("2026-01-31", period, [])),
    ).toEqual(["2026-02-28", "2026-03-31", "2026-04-30"]);
  });

  it("finds the next due date from any day", () => {
    expect(nextDueDate("2026-03-12", [], "2026-04-12")).toBe("2026-04-12");
    expect(nextDueDate("2026-03-12", [], "2026-04-13")).toBe("2026-05-12");
  });
});

describe("freezes push due dates back by their length", () => {
  const tenDayFreeze = { startsOn: "2026-04-01", endsOn: "2026-04-10" };

  it("shifts the next due date and every one after it", () => {
    expect(dueDate("2026-03-12", 1, [tenDayFreeze])).toBe("2026-04-22");
    expect(dueDate("2026-03-12", 2, [tenDayFreeze])).toBe("2026-05-22");
  });

  it("leaves due dates before the freeze alone", () => {
    expect(dueDate("2026-03-12", 0, [tenDayFreeze])).toBe("2026-03-12");
  });

  it("adds up several freezes", () => {
    const later = { startsOn: "2026-06-01", endsOn: "2026-06-05" };
    expect(dueDate("2026-03-12", 3, [later, tenDayFreeze])).toBe("2026-06-27");
  });

  it("holds every due date while a freeze has no end", () => {
    const open = { startsOn: "2026-04-01", endsOn: null };
    expect(dueDate("2026-03-12", 1, [open])).toBeNull();
    expect(nextDueDate("2026-03-12", [open], "2026-05-01")).toBeNull();
  });

  it("knows when a freeze is on", () => {
    expect(activeFreeze([tenDayFreeze], "2026-04-10")).toEqual(tenDayFreeze);
    expect(activeFreeze([tenDayFreeze], "2026-04-11")).toBeNull();
  });
});

describe("agreed fees", () => {
  it("uses the newest change effective by that date", () => {
    const fees = [fee(60000, "2026-03-12"), fee(50000, "2026-06-12")];
    expect(feeOn(fees, "2026-05-30")).toBe(60000);
    expect(feeOn(fees, "2026-06-12")).toBe(50000);
    expect(feeOn(fees, "2026-03-01")).toBeNull();
  });

  it("lets a later correction for the same date win", () => {
    const fees = [
      fee(60000, "2026-03-12", "2026-03-12T10:00:00Z"),
      fee(55000, "2026-03-12", "2026-03-12T10:05:00Z"),
    ];
    expect(feeOn(fees, "2026-03-20")).toBe(55000);
  });

  it("applies a change from the next due date, never to months already due", () => {
    const membership: MembershipFacts = {
      startsOn: "2026-03-12",
      endedOn: null,
      freezes: [],
      fees: [fee(60000, "2026-03-12")],
    };
    expect(feeChangeEffectiveFrom(membership, "2026-04-20")).toBe("2026-05-12");
    expect(feeChangeEffectiveFrom(membership, "2026-05-12")).toBe("2026-05-12");
  });
});

describe("membership status", () => {
  const base: MembershipFacts = {
    startsOn: "2026-03-12",
    endedOn: null,
    freezes: [],
    fees: [fee(60000, "2026-03-12")],
  };

  it("is active for a paying member", () => {
    expect(membershipStatus(true, base, "2026-04-01")).toBe("active");
  });

  it("is free when the agreed fee is zero", () => {
    expect(
      membershipStatus(
        true,
        { ...base, fees: [fee(0, "2026-03-12")] },
        "2026-04-01",
      ),
    ).toBe("free");
  });

  it("is frozen during a freeze, even for a free member", () => {
    const frozen = {
      ...base,
      fees: [fee(0, "2026-03-12")],
      freezes: [{ startsOn: "2026-04-01", endsOn: null }],
    };
    expect(membershipStatus(true, frozen, "2026-04-02")).toBe("frozen");
  });

  it("is inactive when the member or membership has ended", () => {
    expect(membershipStatus(false, base, "2026-04-01")).toBe("inactive");
    expect(
      membershipStatus(true, { ...base, endedOn: "2026-04-01" }, "2026-04-02"),
    ).toBe("inactive");
    expect(membershipStatus(true, null, "2026-04-02")).toBe("inactive");
  });

  it("does not call someone free just because the viewer cannot see fees", () => {
    expect(membershipStatus(true, { ...base, fees: null }, "2026-04-01")).toBe(
      "active",
    );
  });
});

describe("gone quiet", () => {
  const input = {
    startsOn: "2026-01-10",
    lastVisit: null,
    lastPayment: null,
    today: "2026-03-01",
    days: 30,
  };

  it("flags a member with no visit or payment for the whole window", () => {
    expect(isGoneQuiet({ ...input, lastVisit: "2026-01-20" })).toBe(true);
  });

  it("does not flag someone who visited or paid recently", () => {
    expect(isGoneQuiet({ ...input, lastVisit: "2026-02-15" })).toBe(false);
    expect(isGoneQuiet({ ...input, lastPayment: "2026-02-20" })).toBe(false);
  });

  it("gives new members the full window from their joining day", () => {
    expect(isGoneQuiet({ ...input, startsOn: "2026-02-10" })).toBe(false);
  });
});
