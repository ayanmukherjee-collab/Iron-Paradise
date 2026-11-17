// Browser version of listTeam (src/auth/team-queries.ts).
import type { TeamMember } from "@/auth/team-queries";
import { dataOf } from "./action";
import { table } from "./db";

export type { TeamMember };

/** Every account the viewer may see. RLS limits this to owner and managers. */
export async function listTeam(): Promise<TeamMember[]> {
  return dataOf(
    await table("profiles")
      .select("id, fullName:full_name, email, role, isActive:is_active")
      .order("role")
      .order("full_name"),
  ) as TeamMember[];
}
