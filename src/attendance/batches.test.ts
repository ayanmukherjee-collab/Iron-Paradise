import { describe, expect, it } from "vitest";
import {
  batchAt,
  batchHours,
  formatClock,
  gymClock,
  visitBatch,
  type Batches,
} from "@/attendance/batches";

const batches: Batches = {
  morning: { open: "05:00", close: "11:00" },
  evening: { open: "16:00", close: "22:00" },
};

// India is UTC+5:30 all year, so these are fixed gym times.
const ist = (clock: string) => new Date(`2026-11-16T${clock}+05:30`);

describe("batches", () => {
  it("reads the gym clock in India time", () => {
    expect(gymClock(new Date("2026-11-16T00:45:00Z"))).toBe("06:15:00");
  });

  it("places a moment in its batch, closing times exclusive", () => {
    expect(batchAt(ist("05:00:00"), batches)).toBe("morning");
    expect(batchAt(ist("10:59:59"), batches)).toBe("morning");
    expect(batchAt(ist("11:00:00"), batches)).toBeNull();
    expect(batchAt(ist("16:00:00"), batches)).toBe("evening");
    expect(batchAt(ist("21:30:00"), batches)).toBe("evening");
    expect(batchAt(ist("22:00:00"), batches)).toBeNull();
    expect(batchAt(ist("02:00:00"), batches)).toBeNull();
  });

  it("follows an evening batch past midnight", () => {
    const late: Batches = {
      morning: null,
      evening: { open: "18:00", close: "02:00" },
    };
    expect(batchAt(ist("23:30:00"), late)).toBe("evening");
    expect(batchAt(ist("01:59:00"), late)).toBe("evening");
    expect(batchAt(ist("02:00:00"), late)).toBeNull();
  });

  it("knows nothing is open on a day without batches", () => {
    expect(batchAt(ist("06:00:00"), { morning: null, evening: null })).toBe(
      null,
    );
  });

  it("files a visit by half-day when its batch has since closed", () => {
    const eveningOnly: Batches = { morning: null, evening: batches.evening };
    expect(visitBatch(ist("06:00:00"), eveningOnly)).toBe("morning");
    expect(visitBatch(ist("17:00:00"), eveningOnly)).toBe("evening");
  });

  it("writes hours the way people say them", () => {
    expect(formatClock("05:00")).toBe("5 am");
    expect(formatClock("16:30")).toBe("4:30 pm");
    expect(formatClock("12:00")).toBe("12 pm");
    expect(formatClock("00:00")).toBe("midnight");
    expect(batchHours(batches, "evening")).toBe("4 pm – 10 pm");
    expect(batchHours({ morning: null, evening: null }, "morning")).toBe("—");
  });
});
