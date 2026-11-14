import { describe, expect, it } from "vitest";
import { clientIp, safeReturnPath } from "@/lib/request";

describe("safeReturnPath", () => {
  it.each(["/app", "/app/team?tab=staff", "/claim/abc"])(
    "keeps same-site path %s",
    (path) => {
      expect(safeReturnPath(path)).toBe(path);
    },
  );

  it.each([
    "https://evil.example",
    "//evil.example",
    "/\\evil.example",
    "app",
    "",
    null,
    42,
  ])("falls back for %s", (value) => {
    expect(safeReturnPath(value)).toBe("/app");
  });
});

describe("clientIp", () => {
  it("prefers Cloudflare's header", () => {
    const headers = new Headers({
      "cf-connecting-ip": "1.1.1.1",
      "x-forwarded-for": "2.2.2.2",
    });
    expect(clientIp(headers)).toBe("1.1.1.1");
  });

  it("falls back to the first forwarded address", () => {
    expect(
      clientIp(new Headers({ "x-forwarded-for": "3.3.3.3, 10.0.0.1" })),
    ).toBe("3.3.3.3");
  });

  it("says unknown when there is nothing to go on", () => {
    expect(clientIp(new Headers())).toBe("unknown");
  });
});
