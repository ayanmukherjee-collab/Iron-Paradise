import "server-only";
import { asc } from "drizzle-orm";
import type { Viewer } from "@/auth/session";
import { getDb } from "@/db/client";
import { profiles } from "@/db/schema";
import { withUserContext } from "@/db/user-context";

// "member" is left out on purpose: that role comes from linking an account to
// a member record (claim link or staff link), never from picking it here.
export const assignableRoles = [
  "owner",
  "manager",
  "trainer",
  "guest",
] as const;
export type AssignableRole = (typeof assignableRoles)[number];

export type TeamMember = Awaited<ReturnType<typeof listTeam>>[number];

/** Every account the viewer may see. RLS limits this to owner and managers. */
export function listTeam(viewer: Viewer) {
  return withUserContext(getDb(), viewer.userId, (tx) =>
    tx
      .select({
        id: profiles.id,
        fullName: profiles.fullName,
        email: profiles.email,
        role: profiles.role,
        isActive: profiles.isActive,
      })
      .from(profiles)
      .orderBy(asc(profiles.role), asc(profiles.fullName)),
  );
}
