"use server";

// Every export here is a public HTTP endpoint. Export only guardedAction
// results; helpers live in rebuild.ts and publish.ts.
import { z } from "zod";
import { guardedAction } from "@/auth/guarded-action";
import { getDb } from "@/db/client";
import { withUserContext } from "@/db/user-context";
import { publishNow } from "@/bulletin/publish";
import { rebuildBulletin } from "@/bulletin/rebuild";

/** Thrown when there's nowhere to publish to, as our SQL raises. */
class NotPublished extends Error {
  code = "P0001";
}

/**
 * Rebuilds bulletin.json from what's saved and publishes it straight away.
 * Saves already do this on their own; this puts things right if a publish
 * after a save ever failed. It waits for the write so the owner sees whether
 * it worked. Each press is one of the free plan's 1,000 daily KV writes.
 */
export const publishBulletinNow = guardedAction({
  permission: "bulletin.publish",
  input: z.object({}),
  run: async (_input, viewer) => {
    const body = await withUserContext(getDb(), viewer.userId, rebuildBulletin);
    if (!(await publishNow("bulletin.json", body))) {
      throw new NotPublished(
        "Couldn't reach the members' data store. This works only on the live site.",
      );
    }
    const { version } = JSON.parse(body) as { version: number };
    return { message: `Published version ${version}.` };
  },
});
