import { describe, expect, it } from "vitest";
import {
  batchAt,
  batchHours,
  formatClock,
  gymClock,
  toTimeInput,
  type Batches,
} from "@/attendance/batches";

const batches: Batches = {
  morningOpens: "05:00:00",
  morningCloses: "11:00:00",
  eveningOpens: "16:00:00",
  eveningCloses: "22:00:00",
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

  it("writes hours the way people say them", () => {
    expect(formatClock("05:00:00")).toBe("5 am");
    expect(formatClock("16:30:00")).toBe("4:30 pm");
    expect(formatClock("12:00:00")).toBe("12 pm");
    expect(formatClock("24:00:00")).toBe("midnight");
    expect(batchHours(batches, "evening")).toBe("4 pm – 10 pm");
    expect(toTimeInput("5:00")).toBe("05:00");
  });
});
