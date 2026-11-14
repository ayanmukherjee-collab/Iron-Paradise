"use server";

// Every export here is a public HTTP endpoint. Export only guardedAction
// results; plain helpers belong in team-queries.ts.
import { sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { guardedAction } from "@/auth/guarded-action";
import { assignableRoles } from "@/auth/team-queries";
import { getDb } from "@/db/client";
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
