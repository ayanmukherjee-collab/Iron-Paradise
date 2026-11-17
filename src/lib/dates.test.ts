// The date helpers do plain integer arithmetic for real calendar dates and
// fall back to Date for anything else. These tests hold them to the original
// Date-only versions (copied below) across centuries of days, month ends,
// leap years and malformed input, so the speed-up changes no result.
import { describe, expect, it } from "vitest";
import {
  addDays,
  addMonthsClamped,
  daysBetween,
  isIsoDate,
  monthsAfter,
} from "@/lib/dates";

const isoPattern = /^(\d{4})-(\d{2})-(\d{2})$/;
const dayMs = 86_400_000;

const original = {
  toEpochDay(date: string): number {
    const match = isoPattern.exec(date);
    if (!match) throw new RangeError(`Not a YYYY-MM-DD date: ${date}`);
    return (
      Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])) / dayMs
    );
  },
  fromEpochDay(day: number): string {
    return new Date(day * dayMs).toISOString().slice(0, 10);
  },
  isIsoDate(value: string): boolean {
    if (!isoPattern.test(value)) return false;
    return original.fromEpochDay(original.toEpochDay(value)) === value;
  },
  addDays(date: string, days: number): string {
    return original.fromEpochDay(original.toEpochDay(date) + days);
  },
  daysBetween(from: string, to: string): number {
    return original.toEpochDay(to) - original.toEpochDay(from);
  },
  addMonthsClamped(date: string, months: number): string {
    const [year, month, day] = date.split("-").map(Number);
    const target = new Date(Date.UTC(year, month - 1 + months, 1));
    const lastDay = new Date(
      Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
    ).getUTCDate();
    target.setUTCDate(Math.min(day, lastDay));
    return target.toISOString().slice(0, 10);
  },
};

/** Same value, or the same kind of error. */
function outcome(run: () => unknown): unknown {
  try {
    return run();
  } catch (error) {
    return `throws ${(error as Error).name}`;
  }
}

function everyDay(from: string, to: string): string[] {
  const days: string[] = [];
  for (let day = from; day <= to; day = original.addDays(day, 1)) {
    days.push(day);
  }
  return days;
}

const awkward = [
  "2024-02-29",
  "2026-02-29",
  "2026-02-30",
  "2026-04-31",
  "2026-13-01",
  "2026-00-10",
  "2026-01-00",
  "2026-01-32",
  "2026-1-05",
  "2026-01-5",
  "26-01-05",
  "2026/01/05",
  " 2026-01-05",
  "2026-01-05T00:00",
  "",
  "abc",
  "0000-01-01",
  "0050-06-15",
  "0099-12-31",
  "0100-01-01",
  "0999-12-31",
  "1000-01-01",
  "1582-10-10",
  "1900-02-29",
  "2000-02-29",
  "2100-02-29",
  "9999-12-31",
  "9999-01-31",
];

describe("the fast date path matches the original Date-based helpers", () => {
  // Every day of the century the gym will use, plus the turns of 1900 (not
  // a leap year), 2100 (not one either) and 2400 (a leap year).
  const days = [
    ...everyDay("1899-11-01", "1900-04-30"),
    ...everyDay("1999-11-01", "2101-03-31"),
    ...everyDay("2399-11-01", "2400-04-30"),
  ];

  it("addDays and daysBetween, every day", () => {
    for (const day of days) {
      for (const offset of [-366, -1, 0, 1, 3, 400]) {
        const expected = original.addDays(day, offset);
        if (addDays(day, offset) !== expected) {
          expect(addDays(day, offset), `${day} + ${offset}`).toBe(expected);
        }
        if (daysBetween(day, expected) !== offset) {
          expect(daysBetween(day, expected), `${day} → ${expected}`).toBe(
            offset,
          );
        }
      }
    }
  });

  it("addMonthsClamped, every day", () => {
    for (const day of days) {
      for (const months of [-13, -1, 0, 1, 2, 13, 599]) {
        const expected = original.addMonthsClamped(day, months);
        if (addMonthsClamped(day, months) !== expected) {
          expect(addMonthsClamped(day, months), `${day} + ${months}m`).toBe(
            expected,
          );
        }
      }
    }
  });

  it("monthsAfter gives every period's date as addMonthsClamped would", () => {
    for (const start of [
      "2024-01-31",
      "2026-03-12",
      "2023-02-28",
      "1999-12-29",
    ]) {
      const after = monthsAfter(start);
      for (let months = -30; months <= 700; months++) {
        expect(after(months)).toBe(original.addMonthsClamped(start, months));
      }
    }
  });

  it("isIsoDate, every day and the awkward strings", () => {
    for (const day of days) expect(isIsoDate(day)).toBe(true);
    for (const value of awkward) {
      expect(isIsoDate(value), value).toBe(original.isIsoDate(value));
    }
  });

  it("awkward input: odd years, overflow, fractions and garbage", () => {
    for (const value of awkward) {
      for (const n of [-1, 0, 1, 1.5, 12, -0.5, 1e9, Number.NaN]) {
        expect(
          outcome(() => addDays(value, n)),
          `${value} + ${n}`,
        ).toEqual(outcome(() => original.addDays(value, n)));
        expect(
          outcome(() => addMonthsClamped(value, n)),
          `${value} + ${n}m`,
        ).toEqual(outcome(() => original.addMonthsClamped(value, n)));
        expect(
          outcome(() => monthsAfter(value)(n)),
          `monthsAfter ${value} ${n}`,
        ).toEqual(outcome(() => original.addMonthsClamped(value, n)));
      }
      for (const other of ["2026-01-05", "1000-01-01", value]) {
        expect(outcome(() => daysBetween(value, other))).toEqual(
          outcome(() => original.daysBetween(value, other)),
        );
      }
    }
  });

  it("the edges of the fast range", () => {
    const cases: [string, number][] = [
      ["1000-01-01", -1],
      ["1000-01-31", -1],
      ["0999-12-31", 1],
      ["9999-12-31", 1],
      ["9999-12-01", 31],
      ["9999-11-30", 1],
    ];
    for (const [date, n] of cases) {
      expect(outcome(() => addDays(date, n))).toEqual(
        outcome(() => original.addDays(date, n)),
      );
      expect(outcome(() => addMonthsClamped(date, n))).toEqual(
        outcome(() => original.addMonthsClamped(date, n)),
      );
    }
  });
});
