import { describe, expect, it } from "vitest";
import { formatPaise, paiseToInput, parseRupees } from "./money";

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

describe("parseRupees", () => {
  it.each([
    ["600", 60000],
    ["0", 0],
    ["600.5", 60050],
    ["600.05", 60005],
    ["₹1,200", 120000],
    [" 500 ", 50000],
  ])("reads %s as %i paise", (input, paise) => {
    expect(parseRupees(input)).toBe(paise);
  });

  it.each(["", "-5", "abc", "1.234", "12e3"])("rejects %s", (input) => {
    expect(parseRupees(input)).toBeNull();
  });
});

describe("paiseToInput", () => {
  it("round-trips with parseRupees", () => {
    for (const paise of [0, 50000, 60050]) {
      expect(parseRupees(paiseToInput(paise))).toBe(paise);
    }
  });
});
