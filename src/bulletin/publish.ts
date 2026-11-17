import "server-only";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { after } from "next/server";

// Writes the public files to Workers KV, where the iron-paradise-data Worker
// (workers/data) serves them from Cloudflare's cache. Only this server code
// can write: the KV binding exists inside the Worker and nowhere else.
//
// The free plan allows 1,000 KV writes a day, so callers write only after a
// real change (an owner's save) or, for crowd.json, at most once a minute.

export type PublicFile = "bulletin.json" | "crowd.json";

interface PublicDataStore {
  put(key: string, value: string): Promise<void>;
}

let warnedNoStore = false;

function store(): PublicDataStore | null {
  try {
    const env = getCloudflareContext().env as {
      PUBLIC_DATA?: PublicDataStore;
    };
    if (env.PUBLIC_DATA) return env.PUBLIC_DATA;
  } catch {
    // Not running on Workers (`next dev`, tests).
  }
  if (!warnedNoStore) {
    warnedNoStore = true;
    console.warn(
      "PUBLIC_DATA (Workers KV) is not bound here, so bulletin.json and crowd.json are not published. They are on Cloudflare.",
    );
  }
  return null;
}

/**
 * Publishes now and reports whether it worked. Used where a person is
 * waiting for the answer (the owner's "Publish now").
 */
export async function publishNow(
  file: PublicFile,
  body: string,
): Promise<boolean> {
  const kv = store();
  if (!kv) return false;
  await kv.put(file, body);
  return true;
}

/**
 * Publishes after the response has been sent (on Cloudflare, ctx.waitUntil),
 * so the person saving never waits on KV. Call it only after the database
 * transaction that produced `body` has committed, or a rolled-back change
 * could go public.
 *
 * Two saves at nearly the same moment may land in either order; the owner's
 * "Publish now" puts the latest state back if that ever matters.
 */
export function publishLater(file: PublicFile, body: string): void {
  after(async () => {
    try {
      await publishNow(file, body);
    } catch (error) {
      // The save itself succeeded; only the public copy is stale.
      console.error(`Publishing ${file} failed`, error);
    }
  });
}
