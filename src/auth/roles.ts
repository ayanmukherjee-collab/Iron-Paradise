// Which roles staff may hand out, shared by the server and the static app.

// "member" is left out on purpose: that role comes from linking an account to
// a member record (claim link or staff link), never from picking it here.
export const assignableRoles = [
  "owner",
  "manager",
  "trainer",
  "guest",
] as const;
export type AssignableRole = (typeof assignableRoles)[number];

// From a member's page: what their linked account can do. "member" is
// allowed here because the account already belongs to a member record, so
// moving a member who became staff back to plain member is a real case.
export const memberAccountRoles = [
  "member",
  "trainer",
  "manager",
  "owner",
  "guest",
] as const;
