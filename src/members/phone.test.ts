import { describe, expect, it } from "vitest";
import {
  formatMobile,
  normalizeIndianMobile,
  whatsAppLink,
} from "@/members/phone";

describe("normalizeIndianMobile", () => {
  it.each([
    "9876543210",
    "98765 43210",
    "+91 98765-43210",
    "919876543210",
    "09876543210",
  ])("reads %s as the 10-digit number", (input) => {
    expect(normalizeIndianMobile(input)).toBe("9876543210");
  });

  it.each(["12345", "5876543210", "98765432101", "abc"])(
    "rejects %s",
    (input) => {
      expect(normalizeIndianMobile(input)).toBeNull();
    },
  );
});

describe("display and links", () => {
  it("formats in two groups of five", () => {
    expect(formatMobile("9876543210")).toBe("98765 43210");
  });

  it("builds a WhatsApp link with the country code and an encoded message", () => {
    expect(whatsAppLink("9876543210", "Hi & welcome")).toBe(
      "https://wa.me/919876543210?text=Hi%20%26%20welcome",
    );
  });
});
