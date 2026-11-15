import { describe, expect, it } from "vitest";
import {
  can,
  isStaff,
  roles,
  type Action,
  type Role,
} from "@/auth/permissions";

// The role table from section 2 of the brief, written out longhand so a change
// to permissions.ts has to be made deliberately in two places.
const expected: Record<Action, Role[]> = {
  "roles.change": ["owner"],
  "staff.deactivate": ["owner"],
  "payments.void": ["owner"],
  "plans.edit": ["owner"],
  "checkin.settings": ["owner"],
  "members.edit": ["owner", "manager"],
  "memberships.edit": ["owner", "manager"],
  "guests.link": ["owner", "manager"],
  "payments.record": ["owner", "manager"],
  "payments.viewSheet": ["owner", "manager"],
  "reminders.send": ["owner", "manager"],
  "audit.view": ["owner", "manager"],
  "desk.manage": ["owner", "manager"],
  "members.view": ["owner", "manager", "trainer"],
  "payments.viewStatus": ["owner", "manager", "trainer"],
  "attendance.view": ["owner", "manager", "trainer"],
  "attendance.mark": ["owner", "manager", "trainer"],
  "self.view": ["owner", "manager", "trainer", "member"],
  "self.checkIn": ["owner", "manager", "trainer", "member"],
};

describe("can", () => {
  for (const [action, allowed] of Object.entries(expected) as [
    Action,
    Role[],
  ][]) {
    for (const role of roles) {
      const verdict = allowed.includes(role);
      it(`${verdict ? "allows" : "denies"} ${role} → ${action}`, () => {
        expect(can(role, action)).toBe(verdict);
      });
    }
  }

  it("denies everything when there is no role", () => {
    expect(can(null, "self.view")).toBe(false);
    expect(can(undefined, "members.view")).toBe(false);
  });

  it("gives a guest nothing", () => {
    for (const action of Object.keys(expected) as Action[]) {
      expect(can("guest", action)).toBe(false);
    }
  });
});

describe("isStaff", () => {
  it("is true only for owner, manager and trainer", () => {
    expect(roles.filter((role) => isStaff(role))).toEqual([
      "owner",
      "manager",
      "trainer",
    ]);
    expect(isStaff(null)).toBe(false);
  });
});
