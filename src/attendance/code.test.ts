import { describe, expect, it } from "vitest";
import { checkInUrl, codeFromScan, isCheckInCode } from "@/attendance/code";

const site = "https://ironparadise.example";

describe("isCheckInCode", () => {
  it.each(["0123456789ab", "0123456789abcdef0123456789abcdef"])(
    "accepts %s",
    (code) => expect(isCheckInCode(code)).toBe(true),
  );

  it.each([
    "",
    "0123456789AB",
    "0123456789a",
    "0123456789abc",
    "' or 1=1 --",
    null,
    12,
  ])("refuses %s", (code) => expect(isCheckInCode(code)).toBe(false));
});

describe("codeFromScan", () => {
  it("reads the code from our own check-in link", () => {
    expect(codeFromScan(checkInUrl("0123456789ab", site), site)).toBe(
      "0123456789ab",
    );
  });

  it("takes a bare code as it is", () => {
    expect(codeFromScan(" 0123456789ab ", site)).toBe("0123456789ab");
  });

  it.each([
    "https://evil.example/app/check-in?c=0123456789ab",
    `${site}/app/members?c=0123456789ab`,
    `${site}/app/check-in?c=not-a-code`,
    `${site}/app/check-in`,
    "hello",
  ])("ignores %s", (scanned) => {
    expect(codeFromScan(scanned, site)).toBeNull();
  });
});
