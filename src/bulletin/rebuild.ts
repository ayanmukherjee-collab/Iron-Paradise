import "server-only";
import { sql } from "drizzle-orm";
import type { Viewer } from "@/auth/session";
import { getDb } from "@/db/client";
import {
  rowsOf,
  withUserContext,
  type UserTransaction,
} from "@/db/user-context";
import { publishLater } from "@/bulletin/publish";

/**
 * Builds a fresh bulletin.json inside the caller's transaction and returns
 * it as text. Postgres assembles the JSON (public.publish_bulletin), so it
 * reads exactly what this transaction just wrote, and the Worker spends no
 * CPU building or re-encoding it. It also bumps the version number. The
 * function refuses anyone but the owner or a manager.
 */
export async function rebuildBulletin(tx: UserTransaction): Promise<string> {
  const result = await tx.execute(
    sql`select public.publish_bulletin() as body`,
  );
  return rowsOf<{ body: string }>(result)[0].body;
}

/**
 * Every save that changes something in the bulletin goes through here: the
 * change and the rebuild share one transaction, and the new file goes to KV
 * after the response is sent, only once the transaction has committed.
 */
export async function saveAndPublishBulletin<T>(
  viewer: Viewer,
  write: (tx: UserTransaction) => Promise<T>,
): Promise<T> {
  const { value, body } = await withUserContext(
    getDb(),
    viewer.userId,
    async (tx) => {
      const value = await write(tx);
      return { value, body: await rebuildBulletin(tx) };
    },
  );
  publishLater("bulletin.json", body);
  return value;
}
