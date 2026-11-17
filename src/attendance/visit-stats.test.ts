import { describe, expect, it } from "vitest";
import {
  averagePerWeek,
  visitGrid,
  visitWindowStart,
  visitsThisMonth,
  weekStart,
  weekStreak,
  weeklyVisits,
  type WeekCount,
} from "@/attendance/visit-stats";

// 17 Nov 2026 is a Tuesday.
const today = "2026-11-17";

const weeks = (...visits: number[]): WeekCount[] =>
  visits.map((count, i) => ({ start: `w${i}`, visits: count }));

describe("weeks", () => {
  it("start on Monday", () => {
    expect(weekStart("2026-11-17")).toBe("2026-11-16");
    expect(weekStart("2026-11-16")).toBe("2026-11-16");
    expect(weekStart("2026-11-22")).toBe("2026-11-16");
  });

  it("cover thirteen weeks back to a Monday", () => {
    expect(visitWindowStart(today)).toBe("2026-08-24");
  });
});

describe("the visit grid", () => {
  const grid = visitGrid(["2026-11-16", "2026-11-17", "2026-08-24"], today);

  it("has a column per week and a row per weekday", () => {
    expect(grid).toHaveLength(13);
    expect(grid.every((week) => week.length === 7)).toBe(true);
    expect(grid[0][0].date).toBe("2026-08-24");
    expect(grid[12][6].date).toBe("2026-11-22");
  });

  it("marks visits, today and days still to come", () => {
    expect(grid[0][0].visited).toBe(true);
    expect(grid[12][0]).toMatchObject({ visited: true, isToday: false });
    expect(grid[12][1]).toMatchObject({
      visited: true,
      isToday: true,
      future: false,
    });
    expect(grid[12][2]).toMatchObject({ visited: false, future: true });
  });
});

describe("weekly visits", () => {
  it("counts each week, this week last, and ignores visits outside", () => {
    const counts = weeklyVisits(
      [
        "2026-11-16",
        "2026-11-17",
        "2026-11-09",
        "2026-08-24",
        "2026-08-23", // Before the window.
        "2026-11-17", // Same day twice counts once.
      ],
      today,
    );
    expect(counts).toHaveLength(13);
    expect(counts[0]).toEqual({ start: "2026-08-24", visits: 1 });
    expect(counts[11]).toEqual({ start: "2026-11-09", visits: 1 });
    expect(counts[12]).toEqual({ start: "2026-11-16", visits: 2 });
  });
});

describe("week streak", () => {
  it("counts weeks in a row back from this one", () => {
    expect(weekStreak(weeks(1, 0, 2, 3, 1))).toBe(3);
  });

  it("keeps the streak while this week has no visit yet", () => {
    expect(weekStreak(weeks(0, 2, 3, 0))).toBe(2);
  });

  it("is zero after a missed full week", () => {
    expect(weekStreak(weeks(3, 0, 0))).toBe(0);
    expect(weekStreak(weeks())).toBe(0);
  });
});

describe("figures", () => {
  it("averages the finished weeks to one decimal", () => {
    expect(averagePerWeek(weeks(3, 2, 2, 7))).toBe(2.3);
    expect(averagePerWeek(weeks(4))).toBe(0);
  });

  it("counts this month's visits up to today", () => {
    expect(
      visitsThisMonth(
        ["2026-11-01", "2026-11-17", "2026-10-31", "2026-11-17"],
        today,
      ),
    ).toBe(2);
  });
});
