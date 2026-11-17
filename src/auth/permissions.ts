// The one place that decides what each role may do (brief, section 2).
// Features ask `can(role, action)`; none of them re-implement role logic.
// The database enforces the same rules through RLS, so this module decides
// what the app offers and rejects early, while Postgres has the final say.

export const roles = [
  "owner",
  "manager",
  "trainer",
  "member",
  "guest",
] as const;
export type Role = (typeof roles)[number];

const staff = [
  "owner",
  "manager",
  "trainer",
] as const satisfies readonly Role[];
const managers = ["owner", "manager"] as const satisfies readonly Role[];
const ownerOnly = ["owner"] as const satisfies readonly Role[];
// Anyone with a member record can use the member features, including staff
// who also train here.
const holdsMembership = [
  "owner",
  "manager",
  "trainer",
  "member",
] as const satisfies readonly Role[];

const allowedRoles = {
  "roles.change": ownerOnly,
  "staff.deactivate": ownerOnly,
  "payments.void": ownerOnly,
  "members.erase": ownerOnly,
  "plans.edit": ownerOnly,
  "checkin.settings": ownerOnly,

  "members.edit": managers,
  "memberships.edit": managers,
  "guests.link": managers,
  "payments.record": managers,
  "payments.viewSheet": managers,
  "reminders.send": managers,
  "audit.view": managers,
  "desk.manage": managers,

  "members.view": staff,
  "payments.viewStatus": staff,
  "attendance.view": staff,
  "attendance.mark": staff,

  "self.view": holdsMembership,
  "self.checkIn": holdsMembership,
} as const satisfies Record<string, readonly Role[]>;

export type Action = keyof typeof allowedRoles;

export function can(role: Role | null | undefined, action: Action): boolean {
  if (!role) return false;
  return (allowedRoles[action] as readonly Role[]).includes(role);
}

export function isStaff(role: Role | null | undefined): boolean {
  return (
    role !== null &&
    role !== undefined &&
    (staff as readonly Role[]).includes(role)
  );
}

export const roleLabels: Record<Role, string> = {
  owner: "Owner",
  manager: "Manager",
  trainer: "Trainer",
  member: "Member",
  guest: "Guest",
};
