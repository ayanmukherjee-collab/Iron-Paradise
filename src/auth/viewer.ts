import { can, type Action, type Role } from "@/auth/permissions";

/** The signed-in person. The role is read from their profile row. */
export interface Viewer {
  userId: string;
  fullName: string;
  email: string | null;
  role: Role;
  isActive: boolean;
}

export function viewerCan(
  viewer: Viewer | null,
  action: Action,
): viewer is Viewer {
  return viewer !== null && viewer.isActive && can(viewer.role, action);
}
