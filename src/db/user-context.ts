import { sql } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import type * as schema from "./schema";

export type Database = PgDatabase<PgQueryResultHKT, typeof schema>;
export type UserTransaction = Parameters<
  Parameters<Database["transaction"]>[0]
>[0];

/**
 * Runs queries as the signed-in user so Postgres row-level security applies.
 *
 * The server connects as a privileged role, so every query that serves a user
 * must go through here: it switches to the `authenticated` role and sets the
 * same JWT claims Supabase would, making auth.uid() return this user. Both
 * settings are transaction-local and vanish when the transaction ends.
 */
export function withUserContext<T>(
  db: Database,
  userId: string,
  run: (tx: UserTransaction) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    const claims = JSON.stringify({ sub: userId, role: "authenticated" });
    await tx.execute(
      sql`select set_config('request.jwt.claims', ${claims}, true)`,
    );
    await tx.execute(sql`set local role authenticated`);
    return run(tx);
  });
}

/**
 * Rows from a raw `tx.execute(sql...)`. The production driver (postgres-js)
 * returns an array; the in-memory test driver returns `{ rows }`.
 */
export function rowsOf<T>(result: unknown): T[] {
  if (Array.isArray(result)) return result as T[];
  return ((result as { rows?: T[] }).rows ?? []) as T[];
}
