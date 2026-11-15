import "server-only";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { cache } from "react";
import { can, type Action, type Role } from "@/auth/permissions";
import { getDb } from "@/db/client";
import { profiles } from "@/db/schema";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export interface Viewer {
  userId: string;
  fullName: string;
  email: string | null;
  role: Role;
  isActive: boolean;
}

/**
 * The signed-in person, or null. The role is read from the database on every
 * request, never from the JWT or user metadata, so a role change or
 * deactivation applies on the next request.
 */
export const getViewer = cache(async (): Promise<Viewer | null> => {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (typeof userId !== "string") return null;

  // The one query that skips withUserContext, because it runs on every page
  // and a transaction costs three extra round trips. It is safe: the id comes
  // from the signature-checked JWT above, never from the request, and the row
  // read is the caller's own profile, which RLS lets them read anyway.
  const [profile] = await getDb()
    .select({
      fullName: profiles.fullName,
      email: profiles.email,
      role: profiles.role,
      isActive: profiles.isActive,
    })
    .from(profiles)
    .where(eq(profiles.id, userId));
  if (!profile) return null;

  return { userId, ...profile };
});

export function viewerCan(
  viewer: Viewer | null,
  action: Action,
): viewer is Viewer {
  return viewer !== null && viewer.isActive && can(viewer.role, action);
}

/** For pages: sends signed-out visitors to sign in. */
export async function requireViewer(returnTo: string): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer) redirect(`/sign-in?next=${encodeURIComponent(returnTo)}`);
  return viewer;
}

/** For pages: signed-out visitors go to sign in, the rest go home if not allowed. */
export async function requirePermission(
  action: Action,
  returnTo: string,
): Promise<Viewer> {
  const viewer = await requireViewer(returnTo);
  if (!viewerCan(viewer, action)) redirect("/app");
  return viewer;
}
