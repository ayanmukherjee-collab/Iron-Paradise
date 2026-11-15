import { describe, expect, it } from "vitest";
import { appOrigin, clientIp, safeReturnPath } from "@/lib/request";

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

describe("appOrigin", () => {
  const site = "https://ironparadise.example";
  const host = (value: string) => new Headers({ host: value });

  it("always uses the configured site in production, whatever the Host header says", () => {
    expect(appOrigin(host("evil.example"), site, true)).toBe(site);
    expect(appOrigin(host("10.32.243.57:3000"), site, true)).toBe(site);
  });

  it("returns to a phone's LAN address in development", () => {
    expect(appOrigin(host("10.32.243.57:3000"), site, false)).toBe(
      "http://10.32.243.57:3000",
    );
    expect(appOrigin(host("192.168.1.20:3000"), site, false)).toBe(
      "http://192.168.1.20:3000",
    );
    expect(appOrigin(host("localhost:3000"), site, false)).toBe(
      "http://localhost:3000",
    );
  });

  it("ignores public or odd hosts in development too", () => {
    expect(appOrigin(host("evil.example"), site, false)).toBe(site);
    expect(appOrigin(host("172.40.1.1:3000"), site, false)).toBe(site);
    expect(appOrigin(new Headers(), site, false)).toBe(site);
  });
});
