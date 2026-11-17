import { createClient } from "@supabase/supabase-js";
import { env } from "./env";

/**
 * The one Supabase client. The phone talks to the database directly: row-level
 * security decides what each person may read and change, exactly as it did
 * when the server ran queries on their behalf (src/db/user-context.ts).
 *
 * PKCE: Google sends the person back to /auth/callback with a one-time code,
 * which this client exchanges for a session and keeps on the device.
 */
// Untyped on purpose: without generated database types, supabase-js guesses
// row shapes from select strings and gets embedded one-to-one rows wrong
// (it types them as lists). Each query casts to the shape it selects.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyDatabase = any;

export const supabase = createClient<AnyDatabase>(
  env.supabaseUrl,
  env.supabaseKey,
  {
    auth: {
      flowType: "pkce",
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  },
);

/** A message for the person from a failed Supabase call. */
export function errorMessage(
  error: { message?: string; code?: string } | null,
): string {
  // Our SQL functions raise refusals written for people (code P0001).
  if (error?.code === "P0001" && error.message) return error.message;
  return "Something went wrong. Check your connection and try again.";
}
