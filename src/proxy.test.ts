// "An unauthenticated request to any non-public route is rejected" (brief §8).
import { NextRequest } from "next/server";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { isPublicPath } from "@/auth/routes";

beforeAll(() => {
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "http://localhost:3000");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project-ref.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");
  vi.stubEnv("NEXT_PUBLIC_TURNSTILE_SITE_KEY", "1x00000000000000000000AA");
});

async function request(path: string) {
  const { proxy } = await import("@/proxy");
  return proxy(new NextRequest(new URL(path, "http://localhost:3000")));
}

describe("proxy without a session", () => {
  it.each([
    "/app",
    "/app/team",
    "/app/members/123",
    "/app/attendance",
    "/app/check-in?c=0123456789ab",
    "/some-future-page",
  ])(
    "redirects %s to sign in, remembering where they were going",
    async (path) => {
      const response = await request(path);
      expect(response.status).toBe(307);
      const location = new URL(response.headers.get("location")!);
      expect(location.pathname).toBe("/sign-in");
      expect(location.searchParams.get("next")).toBe(path);
    },
  );

  it("answers API routes with 401 instead of a redirect", async () => {
    const response = await request("/api/anything");
    expect(response.status).toBe(401);
  });

  it.each([
    "/",
    "/sign-in",
    "/privacy",
    "/terms",
    "/auth/callback",
    "/~offline",
  ])("lets %s through", async (path) => {
    const response = await request(path);
    expect(response.headers.get("location")).toBeNull();
    expect(response.status).toBe(200);
  });

  it("sends a strict CSP with a nonce on every response", async () => {
    for (const path of ["/", "/app"]) {
      const csp =
        (await request(path)).headers.get("content-security-policy") ?? "";
      expect(csp).toMatch(
        /script-src 'self' 'nonce-[A-Za-z0-9+/=]+' 'strict-dynamic'/,
      );
      expect(csp).toContain("frame-ancestors 'none'");
      expect(csp).not.toMatch(/script-src[^;]*'unsafe-inline'/);
    }
  });
});

describe("isPublicPath", () => {
  it("keeps private anything not explicitly listed", () => {
    expect(isPublicPath("/app")).toBe(false);
    expect(isPublicPath("/sign-in/extra")).toBe(false);
    expect(isPublicPath("/api/health")).toBe(false);
    expect(isPublicPath("/desk")).toBe(false);
    expect(isPublicPath("/app/desk/x")).toBe(false);
  });

  it("opens desk display pages, which check their own secret link", () => {
    expect(isPublicPath("/desk/abc")).toBe(true);
    expect(isPublicPath("/desk/abc/code")).toBe(true);
  });
});
