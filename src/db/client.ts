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
 *   so each request gets its own connection. When the Hyperdrive binding
 *   HYPERDRIVE exists (production, see wrangler.jsonc), it connects through
 *   that: Hyperdrive keeps warm, already-authenticated connections to the
 *   database, so the Worker skips the TLS handshake and password exchange
 *   that otherwise cost CPU and round trips on every request.
 *
 * Prepared statements depend on the route. Supabase's transaction pooler
 * (DATABASE_URL, port 6543) does not support them, so they are off there.
 * Hyperdrive needs them on: Cloudflare warns that `prepare: false` makes
 * Postgres.js send extra messages that Hyperdrive's pooling does not reliably
 * handle, so queries can hang or fail.
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

function connect(
  url: string,
  { max, prepare }: { max: number; prepare: boolean },
): Database {
  const client = postgres(url, {
    prepare,
    fetch_types: false,
    max,
    // Never stack separate queries on one connection outside a transaction:
    // Supabase's transaction pooler stalls on that (measured: it hangs), and
    // Hyperdrive also pools per transaction, so it gets the same caution.
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

const perRequestDb = cache((): Database => {
  const hyperdrive = hyperdriveUrl();
  // A few connections so a page's parallel queries do not queue on one.
  // Cloudflare allows six open connections per request, shared with fetch().
  return hyperdrive
    ? connect(hyperdrive, { max: 3, prepare: true })
    : connect(serverEnv().DATABASE_URL, { max: 3, prepare: false });
});

export function getDb(): Database {
  if (isWorkers) return perRequestDb();
  // Kept on globalThis so dev-server hot reloads reuse the same pool.
  globalForDb.ironParadiseDb ??= connect(serverEnv().DATABASE_URL, {
    max: 5,
    prepare: false,
  });
  return globalForDb.ironParadiseDb;
}
