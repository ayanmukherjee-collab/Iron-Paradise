import { describe, expect, it } from "vitest";
import { describeAuditEntry } from "@/members/audit-text";

describe("describeAuditEntry for check-in changes", () => {
  it("names desk displays set up and switched off", () => {
    expect(
      describeAuditEntry({
        tableName: "desk_displays",
        action: "insert",
        before: null,
        after: { label: "Front desk", revoked_at: null },
      }),
    ).toBe('Desk display "Front desk" set up');
    expect(
      describeAuditEntry({
        tableName: "desk_displays",
        action: "update",
        before: { label: "Front desk", revoked_at: null },
        after: { label: "Front desk", revoked_at: "2026-11-19T10:00:00Z" },
      }),
    ).toBe('Desk display "Front desk" switched off');
  });

  it("tells a printed-QR switch from a gone-quiet change", () => {
    expect(
      describeAuditEntry({
        tableName: "gym_settings",
        action: "update",
        before: { printed_qr_enabled: true, gone_quiet_days: 30 },
        after: { printed_qr_enabled: false, gone_quiet_days: 30 },
      }),
    ).toBe("Printed check-in QR switched off");
    expect(
      describeAuditEntry({
        tableName: "gym_settings",
        action: "update",
        before: { printed_qr_enabled: true, gone_quiet_days: 30 },
        after: { printed_qr_enabled: true, gone_quiet_days: 45 },
      }),
    ).toBe('"Gone quiet" set to 45 days');
  });

  it("says the printed code was replaced without showing it", () => {
    expect(
      describeAuditEntry({
        tableName: "checkin_codes",
        action: "update",
        before: null,
        after: { printed_code: "replaced" },
      }),
    ).toBe("Printed check-in code replaced");
  });
});

describe("describeAuditEntry for account links", () => {
  const member = { member_code: "IP-0003", full_name: "Test Member" };
  it("says when a member is linked and unlinked", () => {
    expect(
      describeAuditEntry({
        tableName: "members",
        action: "update",
        before: { ...member, profile_id: null },
        after: { ...member, profile_id: "a-profile" },
      }),
    ).toBe("IP-0003 Test Member linked to an account");
    expect(
      describeAuditEntry({
        tableName: "members",
        action: "update",
        before: { ...member, profile_id: "a-profile" },
        after: { ...member, profile_id: null },
      }),
    ).toBe("IP-0003 Test Member unlinked from its account");
  });
});

describe("describeAuditEntry for due-day changes", () => {
  it("says when the first payment moves the due day", () => {
    expect(
      describeAuditEntry({
        tableName: "memberships",
        action: "update",
        before: { starts_on: "2026-01-06", billing_starts_on: null },
        after: { starts_on: "2026-01-06", billing_starts_on: "2026-01-08" },
      }),
    ).toBe("Dues now fall monthly from 2026-01-08");
  });
});

describe("describeAuditEntry for the bulletin", () => {
  it("names hours changes, closures and notices", () => {
    const hours = { mon: [{ open: "05:00", close: "10:00" }] };
    expect(
      describeAuditEntry({
        tableName: "gym_settings",
        action: "update",
        before: { weekly_hours: hours, gone_quiet_days: 30 },
        after: { weekly_hours: { mon: [] }, gone_quiet_days: 30 },
      }),
    ).toBe("Opening hours changed");
    expect(
      describeAuditEntry({
        tableName: "gym_closures",
        action: "insert",
        before: null,
        after: { closes_on: "2026-11-20", hours: null, reason: "Diwali" },
      }),
    ).toBe("Closed all day on 2026-11-20: Diwali");
    expect(
      describeAuditEntry({
        tableName: "gym_closures",
        action: "delete",
        before: { closes_on: "2026-11-20", hours: null, reason: "" },
        after: null,
      }),
    ).toBe("Reopened 2026-11-20");
    expect(
      describeAuditEntry({
        tableName: "announcements",
        action: "update",
        before: { title: "Water off", pinned: false },
        after: { title: "Water off", pinned: true },
      }),
    ).toBe("Notice pinned: Water off");
  });
});
