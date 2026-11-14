import { describe, expect, it } from "vitest";
import { formatPaise } from "./money";

describe("formatPaise", () => {
  it("formats whole rupees with Indian digit grouping and no decimals", () => {
    expect(formatPaise(1080000)).toBe("₹10,800");
    expect(formatPaise(1234567800)).toBe("₹1,23,45,678");
  });

  it("keeps paise when the amount is not a whole rupee", () => {
    expect(formatPaise(12050)).toBe("₹120.50");
  });

  it("rejects fractional paise so float money never sneaks in", () => {
    expect(() => formatPaise(100.5)).toThrow(TypeError);
  });
});
