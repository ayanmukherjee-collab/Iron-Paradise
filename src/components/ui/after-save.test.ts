import { describe, expect, it } from "vitest";
import { redirectOf } from "@/components/ui/after-save";

describe("redirectOf", () => {
  it("returns an in-app path a save asked to open", () => {
    expect(redirectOf({ redirectTo: "/app/members/abc" })).toBe(
      "/app/members/abc",
    );
  });

  it("ignores results without a redirect", () => {
    expect(redirectOf(undefined)).toBeNull();
    expect(redirectOf(null)).toBeNull();
    expect(redirectOf({ message: "Saved." })).toBeNull();
    expect(redirectOf({ redirectTo: 42 })).toBeNull();
  });

  it("refuses anything that could leave the site", () => {
    expect(redirectOf({ redirectTo: "//evil.example" })).toBeNull();
    expect(redirectOf({ redirectTo: "/\\evil.example" })).toBeNull();
    expect(redirectOf({ redirectTo: "https://evil.example" })).toBeNull();
    expect(redirectOf({ redirectTo: "javascript:alert(1)" })).toBeNull();
  });
});
