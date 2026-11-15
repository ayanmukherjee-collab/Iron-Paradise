import { describe, expect, it } from "vitest";
import { buildCsp, createNonce } from "@/lib/security/csp";

const base = {
  nonce: "abc123",
  supabaseUrl: "https://project-ref.supabase.co",
  siteUrl: "https://ironparadise.example",
};

describe("buildCsp", () => {
  it("allows scripts only by nonce in production, never inline or eval", () => {
    const csp = buildCsp({ ...base, isDev: false });
    expect(csp).toContain("script-src 'self' 'nonce-abc123' 'strict-dynamic';");
    expect(csp).not.toContain("unsafe-eval");
    expect(csp).not.toMatch(/script-src[^;]*unsafe-inline/);
  });

  it("forbids framing, plugins and foreign base URLs", () => {
    const csp = buildCsp({ ...base, isDev: false });
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'self'");
  });

  it("lets the sign-in form redirect through Supabase to Google", () => {
    expect(buildCsp({ ...base, isDev: false })).toContain(
      "form-action 'self' https://project-ref.supabase.co https://accounts.google.com",
    );
  });

  it("upgrades insecure requests only on an https site", () => {
    expect(buildCsp({ ...base, isDev: false })).toContain(
      "upgrade-insecure-requests",
    );
    expect(
      buildCsp({ ...base, isDev: false, siteUrl: "http://localhost:3000" }),
    ).not.toContain("upgrade-insecure-requests");
  });

  it("adds eval only in development, for React's error overlay", () => {
    expect(buildCsp({ ...base, isDev: true })).toContain("'unsafe-eval'");
  });
});

describe("createNonce", () => {
  it("is different every time", () => {
    expect(createNonce()).not.toBe(createNonce());
  });
});
