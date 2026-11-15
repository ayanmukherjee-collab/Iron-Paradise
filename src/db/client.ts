import "server-only";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { cache } from "react";
import * as schema from "@/db/schema";
import type { Database } from "@/db/user-context";
import { serverEnv } from "@/lib/env";

/**
 * Opening a Postgres connection costs several network round trips (TCP, TLS,
 * auth), which used to be paid on every page. So:
 *
 * - On Node (`next dev`, `next start`) one small pool lives for the life of
 *   the process and every request borrows from it.
 * - On Cloudflare Workers a socket cannot outlive the request that opened it,
 *   so each request gets its own connection. When a Hyperdrive binding named
 *   HYPERDRIVE exists, it connects through that instead: Hyperdrive keeps warm
 *   connections next to the database, so the per-request connect is cheap.
 *
 * `prepare: false` is required by Supabase's transaction pooler.
 * `fetch_types: false` skips a type-lookup query on every new connection; the
 * schema has no custom array types that would need it.
 *
 * These connections bypass RLS. Code serving a user must wrap its queries in
 * withUserContext; see src/db/user-context.ts.
 */
const isWorkers =
  typeof navigator !== "undefined" &&
  navigator.userAgent === "Cloudflare-Workers";

const globalForDb = globalThis as typeof globalThis & {
  ironParadiseDb?: Database;
};

function connect(url: string, max: number): Database {
  const client = postgres(url, {
    prepare: false,
    fetch_types: false,
    max,
    // Never stack separate queries on one connection outside a transaction:
    // Supabase's transaction pooler stalls on that (measured: it hangs).
    // Queries inside withUserContext's transaction still go out together.
    max_pipeline: 1,
    // Hand idle sockets back so the free-tier pooler is not held open.
    idle_timeout: 20,
    connect_timeout: 10,
  });
  return drizzle(client, { schema }) as unknown as Database;
}

function hyperdriveUrl(): string | undefined {
  try {
    const env = getCloudflareContext().env as {
      HYPERDRIVE?: { connectionString: string };
    };
    return env.HYPERDRIVE?.connectionString;
  } catch {
    return undefined;
  }
}

const perRequestDb = cache((): Database =>
  // A few connections so a page's parallel queries do not queue on one.
  connect(hyperdriveUrl() ?? serverEnv().DATABASE_URL, 3),
);

export function getDb(): Database {
  if (isWorkers) return perRequestDb();
  // Kept on globalThis so dev-server hot reloads reuse the same pool.
  globalForDb.ironParadiseDb ??= connect(serverEnv().DATABASE_URL, 5);
  return globalForDb.ironParadiseDb;
}
