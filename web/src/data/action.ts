import type { PostgrestError } from "@supabase/supabase-js";
import type { ActionResult } from "@/auth/guarded-action";

const messages = {
  signedOut: "Your session ended. Sign in again.",
  forbidden: "You don't have access to do that.",
  duplicate: "That already exists.",
} as const;

/** A save the database refused, with a message for the person. */
export class Refusal extends Error {}

/** The phone couldn't get an answer; safe saves may try again. */
export class Unreachable extends Error {}

/**
 * Same messages as the server's guardedAction (src/auth/guarded-action.ts):
 * messages our SQL functions raise are written for people, raw RLS and
 * privilege errors get a generic line.
 */
export function failureFor(error: PostgrestError): Error {
  switch (error.code) {
    case "42501":
      return new Refusal(
        /row-level security|permission denied/.test(error.message)
          ? messages.forbidden
          : error.message,
      );
    case "23505":
      return new Refusal(messages.duplicate);
    case "P0001":
    case "P0002":
    case "22023":
      return new Refusal(error.message);
    case "PGRST301":
    case "PGRST303":
      return new Refusal(messages.signedOut);
    default:
      return new Unreachable(error.message || "No answer from the database");
  }
}

/** Throws for a failed Supabase call, else returns its data. */
export function dataOf<T>(result: {
  data: T | null;
  error: PostgrestError | null;
}): T {
  if (result.error) throw failureFor(result.error);
  // Without an error, data is only null where the caller's T allows it
  // (maybeSingle finding nothing).
  return result.data as T;
}

/**
 * Runs a save and turns refusals into the ActionResult the shared form
 * components expect. Anything else (the phone is offline, say) is thrown, so
 * callers that may retry, like check-in, can.
 */
export async function runAction<T>(
  run: () => Promise<T>,
): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await run() };
  } catch (error) {
    if (error instanceof Refusal) return { ok: false, error: error.message };
    throw error;
  }
}
