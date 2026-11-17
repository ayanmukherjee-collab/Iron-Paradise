import { describe, expect, it } from "vitest";
import {
  closedBatches,
  closureFor,
  closuresWithin,
  getOpenStatus,
  gymMoment,
  openBlocksOn,
  openingAt,
  splitBatches,
} from "@/bulletin/hours";
import type { Bulletin, WeeklyHours } from "@/bulletin/types";

const morning = { open: "05:30", close: "10:00" };
const evening = { open: "16:00", close: "22:00" };
const twoBatches = [morning, evening];

const weekly: WeeklyHours = {
  sun: [],
  mon: twoBatches,
  tue: twoBatches,
  wed: twoBatches,
  thu: twoBatches,
  fri: twoBatches,
  sat: twoBatches,
};

function source(
  overrides: Partial<Pick<Bulletin, "hours" | "closures">> = {},
): Pick<Bulletin, "hours" | "closures"> {
  return { hours: weekly, closures: [], ...overrides };
}

/** A moment given in gym time (IST, UTC+5:30). */
function ist(local: string): Date {
  return new Date(`${local}:00+05:30`);
}

// 2026-11-16 is a Monday; 2026-11-22 a Sunday.

describe("gymMoment", () => {
  it("uses the gym's clock, not the device's", () => {
    // 20:00 UTC on the 16th is 01:30 on the 17th in India.
    expect(gymMoment(new Date("2026-11-16T20:00:00Z"))).toEqual({
      date: "2026-11-17",
      minutes: 90,
    });
  });
});

describe("getOpenStatus", () => {
  it("is open inside an opening and says when it closes", () => {
    expect(getOpenStatus(source(), ist("2026-11-16T18:30")).label).toBe(
      "Open now · closes 10 PM",
    );
  });

  it("counts the opening minute in and the closing minute out", () => {
    expect(getOpenStatus(source(), ist("2026-11-16T05:30")).state).toBe("open");
    expect(getOpenStatus(source(), ist("2026-11-16T10:00")).label).toBe(
      "Closed · opens 4 PM",
    );
  });

  it("names the next opening before the doors open", () => {
    expect(getOpenStatus(source(), ist("2026-11-16T04:00")).label).toBe(
      "Closed · opens 5:30 AM",
    );
  });

  it("looks to tomorrow after the last opening", () => {
    expect(getOpenStatus(source(), ist("2026-11-16T22:30")).label).toBe(
      "Closed · opens 5:30 AM tomorrow",
    );
  });

  it("skips a day with no hours", () => {
    // Saturday night: Sunday is shut, so Monday.
    expect(getOpenStatus(source(), ist("2026-11-21T23:00")).label).toBe(
      "Closed · opens 5:30 AM Mon",
    );
  });

  it("shows a full-day closure with its reason", () => {
    const status = getOpenStatus(
      source({
        closures: [{ date: "2026-11-16", reason: "Diwali", hours: null }],
      }),
      ist("2026-11-16T18:30"),
    );
    expect(status.label).toBe("Closed today: Diwali");
  });

  it("says closed today when the closure has no reason", () => {
    const status = getOpenStatus(
      source({ closures: [{ date: "2026-11-16", reason: "", hours: null }] }),
      ist("2026-11-16T07:00"),
    );
    expect(status.label).toBe("Closed today");
  });

  it("uses a closure's shortened hours instead of the usual ones", () => {
    const shortened = source({
      closures: [
        {
          date: "2026-11-16",
          reason: "Christmas",
          hours: [{ open: "06:00", close: "12:00" }],
        },
      ],
    });
    expect(getOpenStatus(shortened, ist("2026-11-16T11:00")).label).toBe(
      "Open now · closes 12 PM",
    );
    expect(getOpenStatus(shortened, ist("2026-11-16T18:00")).label).toBe(
      "Closed · opens 5:30 AM tomorrow",
    );
  });

  it("keeps a late opening open past midnight", () => {
    const late = source({
      hours: { ...weekly, fri: [{ open: "18:00", close: "02:00" }] },
    });
    // Friday 20 Nov 23:00, then 01:30 on Saturday.
    expect(getOpenStatus(late, ist("2026-11-20T23:00")).label).toBe(
      "Open now · closes 2 AM",
    );
    expect(getOpenStatus(late, ist("2026-11-21T01:30")).label).toBe(
      "Open now · closes 2 AM",
    );
    expect(getOpenStatus(late, ist("2026-11-21T02:00")).label).toBe(
      "Closed · opens 5:30 AM",
    );
  });

  it("says closed with no opening in the next week", () => {
    const shut = source({
      hours: {
        sun: [],
        mon: [],
        tue: [],
        wed: [],
        thu: [],
        fri: [],
        sat: [],
      },
    });
    expect(getOpenStatus(shut, ist("2026-11-16T12:00")).label).toBe("Closed");
  });
});

describe("openingAt", () => {
  it("returns the opening running then", () => {
    expect(openingAt(source(), "2026-11-16", 17 * 60)).toEqual(evening);
    expect(openingAt(source(), "2026-11-22", 17 * 60)).toBeNull();
  });
});

describe("closuresWithin", () => {
  it("keeps closures from today to three days ahead, soonest first", () => {
    const closures = [
      { date: "2026-11-20", reason: "Too far", hours: null },
      { date: "2026-11-18", reason: "Soon", hours: null },
      { date: "2026-11-15", reason: "Past", hours: null },
      { date: "2026-11-16", reason: "Today", hours: null },
    ];
    expect(
      closuresWithin(source({ closures }), ist("2026-11-16T09:00"), 3).map(
        (c) => c.reason,
      ),
    ).toEqual(["Today", "Soon"]);
  });
});

describe("batches", () => {
  it("splits a day at noon", () => {
    expect(splitBatches(twoBatches)).toEqual({ morning, evening });
    expect(splitBatches([evening])).toEqual({ morning: null, evening });
  });

  it("works out which batches a closure shuts", () => {
    expect(closedBatches(twoBatches, null)).toEqual({
      morning: false,
      evening: false,
    });
    expect(closedBatches(twoBatches, { hours: null })).toEqual({
      morning: true,
      evening: true,
    });
    expect(closedBatches(twoBatches, { hours: [evening] })).toEqual({
      morning: true,
      evening: false,
    });
    // A day with no morning batch has no morning to shut.
    expect(closedBatches([evening], { hours: null })).toEqual({
      morning: false,
      evening: true,
    });
  });

  it("builds the closure for the batches chosen", () => {
    expect(closureFor(twoBatches, { morning: false, evening: false })).toBe(
      "open",
    );
    expect(closureFor(twoBatches, { morning: true, evening: false })).toEqual({
      hours: [evening],
    });
    expect(closureFor(twoBatches, { morning: true, evening: true })).toEqual({
      hours: null,
    });
    // Shutting the only batch shuts the day.
    expect(closureFor([evening], { morning: false, evening: true })).toEqual({
      hours: null,
    });
  });
});

describe("openBlocksOn", () => {
  it("gives a day's openings as minutes", () => {
    expect(openBlocksOn(source(), "2026-11-16")).toEqual([
      { from: 330, to: 600 },
      { from: 960, to: 1320 },
    ]);
  });

  it("is empty on a closed day and follows a closure's hours", () => {
    expect(openBlocksOn(source(), "2026-11-22")).toEqual([]);
    const short = source({
      closures: [{ date: "2026-11-17", reason: "", hours: [morning] }],
    });
    expect(openBlocksOn(short, "2026-11-17")).toEqual([{ from: 330, to: 600 }]);
  });

  it("cuts a late opening at midnight and carries its tail to the next day", () => {
    const late = source({
      hours: { ...weekly, mon: [{ open: "18:00", close: "02:00" }] },
    });
    expect(openBlocksOn(late, "2026-11-16")).toEqual([
      { from: 1080, to: 1440 },
    ]);
    expect(openBlocksOn(late, "2026-11-17")).toEqual([
      { from: 0, to: 120 },
      { from: 330, to: 600 },
      { from: 960, to: 1320 },
    ]);
  });
});
