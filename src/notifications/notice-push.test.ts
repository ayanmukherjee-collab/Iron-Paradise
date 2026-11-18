import { describe, expect, it } from "vitest";
import { noticePush, shortNotice } from "@/notifications/notice-push";

describe("notice notifications", () => {
  it("uses the heading as the title and the notice as the body", () => {
    expect(
      noticePush({ id: "n1", title: " Closed Sunday ", body: "For Holi." }),
    ).toEqual({
      title: "Closed Sunday",
      body: "For Holi.",
      url: "/app",
      tag: "notice-n1",
    });
  });

  it("says something when the notice has no text", () => {
    expect(noticePush({ id: "n2", title: "Hi", body: "  " }).body).toBe(
      "New notice from Iron Paradise",
    );
  });

  it("keeps long notices short, on a whole word", () => {
    const body = `${"Bring your own towel from Monday. ".repeat(8)}`;
    const short = shortNotice(body);
    expect(short.length).toBeLessThanOrEqual(120);
    expect(short.endsWith("…")).toBe(true);
    expect(short).not.toMatch(/\s…$/);
    expect(body.startsWith(short.slice(0, -1))).toBe(true);
  });

  it("joins lines into one", () => {
    expect(shortNotice("Line one\n\nLine two")).toBe("Line one Line two");
  });
});
