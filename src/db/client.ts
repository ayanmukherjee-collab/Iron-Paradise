import "server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { cache } from "react";
import * as schema from "@/db/schema";
import type { Database } from "@/db/user-context";
import { serverEnv } from "@/lib/env";

/**
 * One connection per request. Cloudflare Workers cannot share sockets between
 * requests, so a long-lived pool would break. `prepare: false` is required by
 * Supabase's transaction pooler.
 *
 * This connection bypasses RLS. Code serving a user must wrap its queries in
 * withUserContext; see src/db/user-context.ts.
 */
export const getDb = cache((): Database => {
  const client = postgres(serverEnv().DATABASE_URL, { prepare: false, max: 1 });
  return drizzle(client, { schema }) as unknown as Database;
});
