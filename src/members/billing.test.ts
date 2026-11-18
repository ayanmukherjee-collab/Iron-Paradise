import { describe, expect, it } from "vitest";
import {
  activeFreeze,
  dueDate,
  feeChangeEffectiveFrom,
  feeOn,
  isGoneQuiet,
  membershipStatus,
  nextDueDate,
  rescheduled,
  type DueChange,
  type FeeChange,
  type Freeze,
  type MembershipFacts,
  type Schedule,
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

const schedule = (
  billingStartsOn: string,
  freezes: Freeze[] = [],
  dueChanges: DueChange[] = [],
): Schedule => ({ billingStartsOn, dueChanges, freezes });

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
      [0, 1, 2].map((period) => dueDate(schedule("2026-03-12", []), period)),
    ).toEqual(["2026-03-12", "2026-04-12", "2026-05-12"]);
  });

  it("moves to the last day of short months and back again after", () => {
    expect(
      [1, 2, 3].map((period) => dueDate(schedule("2026-01-31", []), period)),
    ).toEqual(["2026-02-28", "2026-03-31", "2026-04-30"]);
  });

  it("follows the first payment's day once the member has paid", () => {
    // Joined 6 Jan, first paid 8 Jan: every later fee falls due on the 8th.
    expect(
      [0, 1, 2].map((period) => dueDate(schedule("2026-01-08", []), period)),
    ).toEqual(["2026-01-08", "2026-02-08", "2026-03-08"]);
    expect(nextDueDate(schedule("2026-01-08", []), "2026-01-09")).toBe(
      "2026-02-08",
    );
  });

  it("finds the next due date from any day", () => {
    expect(nextDueDate(schedule("2026-03-12", []), "2026-04-12")).toBe(
      "2026-04-12",
    );
    expect(nextDueDate(schedule("2026-03-12", []), "2026-04-13")).toBe(
      "2026-05-12",
    );
  });
});

describe("freezes push due dates back by their length", () => {
  const tenDayFreeze = { startsOn: "2026-04-01", endsOn: "2026-04-10" };

  it("shifts the next due date and every one after it", () => {
    expect(dueDate(schedule("2026-03-12", [tenDayFreeze]), 1)).toBe(
      "2026-04-22",
    );
    expect(dueDate(schedule("2026-03-12", [tenDayFreeze]), 2)).toBe(
      "2026-05-22",
    );
  });

  it("leaves due dates before the freeze alone", () => {
    expect(dueDate(schedule("2026-03-12", [tenDayFreeze]), 0)).toBe(
      "2026-03-12",
    );
  });

  it("adds up several freezes", () => {
    const later = { startsOn: "2026-06-01", endsOn: "2026-06-05" };
    expect(dueDate(schedule("2026-03-12", [later, tenDayFreeze]), 3)).toBe(
      "2026-06-27",
    );
  });

  it("holds every due date while a freeze has no end", () => {
    const open = { startsOn: "2026-04-01", endsOn: null };
    expect(dueDate(schedule("2026-03-12", [open]), 1)).toBeNull();
    expect(
      nextDueDate(schedule("2026-03-12", [open]), "2026-05-01"),
    ).toBeNull();
  });

  it("knows when a freeze is on", () => {
    expect(activeFreeze([tenDayFreeze], "2026-04-10")).toEqual(tenDayFreeze);
    expect(activeFreeze([tenDayFreeze], "2026-04-11")).toBeNull();
  });
});

describe("staff can move the due date", () => {
  // Dues on the 5th; period 3 (5 Apr) moved to the 10th.
  const movedTo10th = schedule(
    "2026-01-05",
    [],
    [{ fromPeriod: 3, dueOn: "2026-04-10" }],
  );

  it("keeps earlier months and moves this one and every later one", () => {
    expect(
      [0, 1, 2, 3, 4, 5].map((period) => dueDate(movedTo10th, period)),
    ).toEqual([
      "2026-01-05",
      "2026-02-05",
      "2026-03-05",
      "2026-04-10",
      "2026-05-10",
      "2026-06-10",
    ]);
    expect(nextDueDate(movedTo10th, "2026-04-06")).toBe("2026-04-10");
    expect(nextDueDate(movedTo10th, "2026-04-11")).toBe("2026-05-10");
  });

  it("lets the newest change win from where it starts", () => {
    const twice = schedule(
      "2026-01-05",
      [],
      [
        { fromPeriod: 3, dueOn: "2026-04-10" },
        { fromPeriod: 5, dueOn: "2026-06-20" },
      ],
    );
    expect([4, 5, 6].map((period) => dueDate(twice, period))).toEqual([
      "2026-05-10",
      "2026-06-20",
      "2026-07-20",
    ]);
  });

  it("can start dues on any day with a change at period 0", () => {
    const fromDec = schedule(
      "2026-01-05",
      [],
      [{ fromPeriod: 0, dueOn: "2025-12-28" }],
    );
    expect([0, 1].map((period) => dueDate(fromDec, period))).toEqual([
      "2025-12-28",
      "2026-01-28",
    ]);
  });

  it("is still pushed back by freezes after the new date", () => {
    const frozen = {
      ...movedTo10th,
      freezes: [{ startsOn: "2026-04-20", endsOn: "2026-04-29" }],
    };
    expect(dueDate(frozen, 3)).toBe("2026-04-10");
    expect(dueDate(frozen, 4)).toBe("2026-05-20");
  });

  describe("rescheduled", () => {
    const fifth = schedule("2026-01-05");

    it("moves a month and the ones after it to the day picked", () => {
      const changes = rescheduled(fifth, 3, "2026-04-10");
      expect(changes).toEqual([{ fromPeriod: 3, dueOn: "2026-04-10" }]);
      expect(dueDate({ ...fifth, dueChanges: changes! }, 4)).toBe("2026-05-10");
    });

    it("can move a month earlier, but not to or before the month before it", () => {
      expect(rescheduled(fifth, 3, "2026-03-20")).toEqual([
        { fromPeriod: 3, dueOn: "2026-03-20" },
      ]);
      expect(rescheduled(fifth, 3, "2026-03-05")).toBeNull();
    });

    it("allows any date for period 0", () => {
      expect(rescheduled(fifth, 0, "2025-06-01")).toEqual([
        { fromPeriod: 0, dueOn: "2025-06-01" },
      ]);
      expect(rescheduled(fifth, 0, "2027-06-01")).toEqual([
        { fromPeriod: 0, dueOn: "2027-06-01" },
      ]);
    });

    it("replaces changes from that month on and keeps earlier ones", () => {
      const moved = schedule(
        "2026-01-05",
        [],
        [
          { fromPeriod: 2, dueOn: "2026-03-10" },
          { fromPeriod: 4, dueOn: "2026-05-20" },
        ],
      );
      expect(rescheduled(moved, 3, "2026-04-15")).toEqual([
        { fromPeriod: 2, dueOn: "2026-03-10" },
        { fromPeriod: 3, dueOn: "2026-04-15" },
      ]);
    });

    it("lands exactly on the day picked when an earlier freeze shifts dates", () => {
      // A 10-day freeze in February pushes every later due by 10 days.
      const frozen = schedule("2026-01-05", [
        { startsOn: "2026-02-01", endsOn: "2026-02-10" },
      ]);
      expect(dueDate(frozen, 2)).toBe("2026-03-15");
      const changes = rescheduled(frozen, 3, "2026-04-20")!;
      const after = { ...frozen, dueChanges: changes };
      expect(dueDate(after, 3)).toBe("2026-04-20");
      expect(dueDate(after, 4)).toBe("2026-05-20");
    });

    it("refuses a frozen day and a freeze with no end", () => {
      const frozen = schedule("2026-01-05", [
        { startsOn: "2026-04-01", endsOn: "2026-04-30" },
      ]);
      expect(rescheduled(frozen, 3, "2026-04-15")).toBeNull();
      const open = schedule("2026-01-05", [
        { startsOn: "2026-03-01", endsOn: null },
      ]);
      expect(rescheduled(open, 3, "2026-04-15")).toBeNull();
    });
  });
});

describe("agreed fees", () => {
  it("uses the newest change effective by that date", () => {
    const fees = [fee(60000, "2026-03-12"), fee(50000, "2026-06-12")];
    expect(feeOn(fees, "2026-05-30")).toBe(60000);
    expect(feeOn(fees, "2026-06-12")).toBe(50000);
    // Before the first fee took effect (dues moved before joining): the first.
    expect(feeOn(fees, "2026-03-01")).toBe(60000);
    expect(feeOn([], "2026-03-01")).toBeNull();
  });

  it("lets a later correction for the same date win", () => {
    const fees = [
      fee(60000, "2026-03-12", "2026-03-12T10:00:00Z"),
      fee(55000, "2026-03-12", "2026-03-12T10:05:00Z"),
    ];
    expect(feeOn(fees, "2026-03-20")).toBe(55000);
  });

  it("applies a change from this month on, never to earlier months", () => {
    const membership: MembershipFacts = {
      startsOn: "2026-03-12",
      billingStartsOn: "2026-03-12",
      dueChanges: [],
      endedOn: null,
      freezes: [],
      fees: [fee(60000, "2026-03-12")],
    };
    // In the month that fell due on 12 Apr: from 12 Apr.
    expect(feeChangeEffectiveFrom(membership, "2026-04-20")).toBe("2026-04-12");
    expect(feeChangeEffectiveFrom(membership, "2026-05-12")).toBe("2026-05-12");
    // Before the first due date: from today.
    expect(feeChangeEffectiveFrom(membership, "2026-03-01")).toBe("2026-03-01");
  });

  it("lets the newest edit win over an older change dated later", () => {
    const fees = [
      fee(60000, "2026-03-12", "2026-03-12T10:00:00Z"),
      // Saved in April under the old rule, to start on 12 May.
      fee(80000, "2026-05-12", "2026-04-20T10:00:00Z"),
      // Saved later, applying from this month.
      fee(70000, "2026-04-12", "2026-04-25T10:00:00Z"),
    ];
    expect(feeOn(fees, "2026-04-12")).toBe(70000);
    expect(feeOn(fees, "2026-05-12")).toBe(70000);
    expect(feeOn(fees, "2026-03-20")).toBe(60000);
  });
});

describe("membership status", () => {
  const base: MembershipFacts = {
    startsOn: "2026-03-12",
    billingStartsOn: "2026-03-12",
    dueChanges: [],
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
