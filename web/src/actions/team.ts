// Browser versions of src/auth/team-actions.ts.
import { z } from "zod";
import { roleLabels } from "@/auth/permissions";
import { assignableRoles, memberAccountRoles } from "@/auth/roles";
import { dataOf, Refusal } from "../data/action";
import { rpc, table } from "../data/db";
import { guardedAction } from "../data/guarded";

export const changeRole = guardedAction({
  permission: "roles.change",
  input: z.object({
    profileId: z.uuid(),
    role: z.enum(assignableRoles, "Pick a role"),
  }),
  run: async ({ profileId, role }) => {
    await rpc("set_user_role", { target: profileId, new_role: role });
  },
});

export const changeMemberRole = guardedAction({
  permission: "roles.change",
  input: z.object({
    memberId: z.uuid(),
    role: z.enum(memberAccountRoles, "Pick a type"),
  }),
  run: async ({ memberId, role }) => {
    const member = dataOf(
      await table("members")
        .select("profile_id")
        .eq("id", memberId)
        .maybeSingle(),
    ) as { profile_id: string | null } | null;
    if (!member?.profile_id) {
      throw new Refusal(
        "They haven't linked an account yet, so there's no type to change.",
      );
    }
    await rpc("set_user_role", { target: member.profile_id, new_role: role });
    return {
      message: `Saved. They're now a ${roleLabels[role].toLowerCase()}.`,
    };
  },
});

export const setAccountActive = guardedAction({
  permission: "staff.deactivate",
  input: z.object({
    profileId: z.uuid(),
    active: z.enum(["true", "false"]).transform((value) => value === "true"),
  }),
  run: async ({ profileId, active }) => {
    await rpc("set_user_active", { target: profileId, active });
  },
});
