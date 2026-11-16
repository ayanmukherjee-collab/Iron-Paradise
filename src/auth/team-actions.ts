"use server";

// Every export here is a public HTTP endpoint. Export only guardedAction
// results; plain helpers belong in team-queries.ts.
import { eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { guardedAction } from "@/auth/guarded-action";
import { roleLabels } from "@/auth/permissions";
import { assignableRoles, memberAccountRoles } from "@/auth/team-queries";
import { getDb } from "@/db/client";
import { members } from "@/db/schema";
import { withUserContext } from "@/db/user-context";

export const changeRole = guardedAction({
  permission: "roles.change",
  input: z.object({
    profileId: z.uuid(),
    role: z.enum(assignableRoles, "Pick a role"),
  }),
  run: async ({ profileId, role }, viewer) => {
    await withUserContext(getDb(), viewer.userId, (tx) =>
      tx.execute(
        sql`select public.set_user_role(${profileId}, ${role}::public.app_role)`,
      ),
    );
    revalidatePath("/app/team");
  },
});

export const changeMemberRole = guardedAction({
  permission: "roles.change",
  input: z.object({
    memberId: z.uuid(),
    role: z.enum(memberAccountRoles, "Pick a type"),
  }),
  run: async ({ memberId, role }, viewer) => {
    await withUserContext(getDb(), viewer.userId, async (tx) => {
      const [member] = await tx
        .select({ profileId: members.profileId })
        .from(members)
        .where(eq(members.id, memberId));
      if (!member?.profileId) throw new NoAccountError();
      await tx.execute(
        sql`select public.set_user_role(${member.profileId}, ${role}::public.app_role)`,
      );
    });
    revalidatePath(`/app/members/${memberId}`);
    revalidatePath("/app/team");
    return {
      message: `Saved. They're now a ${roleLabels[role].toLowerCase()}.`,
    };
  },
});

class NoAccountError extends Error {
  code = "P0001";
  constructor() {
    super("They haven't linked an account yet, so there's no type to change.");
  }
}

export const setAccountActive = guardedAction({
  permission: "staff.deactivate",
  input: z.object({
    profileId: z.uuid(),
    active: z.enum(["true", "false"]).transform((value) => value === "true"),
  }),
  run: async ({ profileId, active }, viewer) => {
    await withUserContext(getDb(), viewer.userId, (tx) =>
      tx.execute(sql`select public.set_user_active(${profileId}, ${active})`),
    );
    revalidatePath("/app/team");
  },
});
