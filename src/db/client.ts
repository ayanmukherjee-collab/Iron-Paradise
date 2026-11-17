import type { Database } from "@/db/user-context";

/**
 * The server-side query modules (members, payments, attendance and so on)
 * take their connection from here. Nothing in the static app opens one:
 * phones go through the Supabase Data API, and the Edge Functions
 * (supabase/functions-src) pass their own. Tests replace this with an
 * in-memory database.
 */
export function getDb(): Database {
  throw new Error(
    "No server database connection here. Use the Supabase client (web/src/lib/supabase.ts) or pass a connection.",
  );
}
