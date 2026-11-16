import { describe, expect, it } from "vitest";
import { hasCronSecret } from "@/notifications/cron-auth";

const secret = "s".repeat(40);

describe("the cron route's secret", () => {
  it("accepts the right bearer token", () => {
    expect(hasCronSecret(`Bearer ${secret}`, secret)).toBe(true);
  });

  it.each([
    [null],
    [""],
    [secret],
    [`Bearer ${secret}x`],
    ["Bearer "],
    [`Basic ${secret}`],
  ])("rejects %j", (header) => {
    expect(hasCronSecret(header, secret)).toBe(false);
  });

  it("refuses everything while no secret is set", () => {
    expect(hasCronSecret("Bearer ", undefined)).toBe(false);
    expect(hasCronSecret("Bearer ", "")).toBe(false);
  });
});
