import { describe, expect, it } from "vitest";
import type { HoursRow } from "@/content/landing";
import { gymNow, hourLabel, openStatus } from "./open-status";

const rows: HoursRow[] = [
  { label: "Evening", icon: "moon", from: 16, to: 22, slot: "4 – 10 PM" },
  { label: "Morning", icon: "sun", from: 5, to: 10, slot: "5 – 10 AM" },
];
const [evening, morning] = rows;
const SUNDAY = 0;
const MONDAY = 1;
const SATURDAY = 6;

describe("gymNow", () => {
  it("reads the time and day in India, not the server's zone", () => {
    // Monday 10:30 UTC is Monday 16:00 in India (UTC+5:30).
    expect(gymNow(new Date("2026-11-16T10:30:00Z"))).toEqual({
      hour: 16,
      day: MONDAY,
    });
    // Monday 18:45 UTC is already Tuesday 00:15 in India.
    expect(gymNow(new Date("2026-11-16T18:45:00Z"))).toEqual({
      hour: 0.25,
      day: 2,
    });
  });
});

describe("openStatus", () => {
  const at = (day: number, hour: number) =>
    openStatus(rows, { day, hour }, [SUNDAY]);

  it("is open inside a session", () => {
    expect(at(MONDAY, 5)).toEqual({ open: true, row: morning });
    expect(at(SATURDAY, 21.9)).toEqual({ open: true, row: evening });
  });

  it("names the next session later today", () => {
    expect(at(MONDAY, 12)).toEqual({ open: false, next: evening, day: null });
    expect(at(MONDAY, 2)).toEqual({ open: false, next: morning, day: null });
  });

  it("points to tomorrow morning after closing time", () => {
    expect(at(MONDAY, 22)).toEqual({ open: false, next: morning, day: 2 });
  });

  it("stays shut on Sunday and skips it", () => {
    expect(at(SUNDAY, 6)).toEqual({ open: false, next: morning, day: MONDAY });
    expect(at(SATURDAY, 23)).toEqual({
      open: false,
      next: morning,
      day: MONDAY,
    });
  });
});

describe("hourLabel", () => {
  it("uses a 12-hour clock", () => {
    expect(hourLabel(0)).toBe("12 AM");
    expect(hourLabel(5)).toBe("5 AM");
    expect(hourLabel(12)).toBe("12 PM");
    expect(hourLabel(22)).toBe("10 PM");
  });
});
