import type { z } from "zod";
import type { ActionResult } from "@/auth/action-result";
import type { Action } from "@/auth/permissions";
import { currentViewer, viewerCan, type Viewer } from "../auth/viewer";
import { Refusal, Unreachable } from "./action";

const messages = {
  signedOut: "Your session ended. Sign in again.",
  forbidden: "You don't have access to do that.",
  unreachable:
    "Couldn't reach the gym's database. Check your connection and try again.",
} as const;

/**
 * The browser's version of the server's guardedAction
 * (src/auth/guarded-action.ts), with the same signature, so the shared forms
 * (ActionForm and friends) take these as they took Server Actions. It checks
 * the session, the permission and the input with the same Zod schemas before
 * acting. These checks are for the person's sake: the database checks every
 * write against the signed-in user anyway (RLS, column grants, SQL
 * functions), as it did when the server made the call.
 */
export function guardedAction<Schema extends z.ZodType, T>(options: {
  permission: Action;
  input: Schema;
  run: (input: z.infer<Schema>, viewer: Viewer) => Promise<T>;
}): (raw: unknown) => Promise<ActionResult<T>> {
  return async (raw) => {
    const viewer = currentViewer();
    if (!viewer) return { ok: false, error: messages.signedOut };
    if (!viewerCan(viewer, options.permission))
      return { ok: false, error: messages.forbidden };

    const parsed = options.input.safeParse(
      raw instanceof FormData ? Object.fromEntries(raw) : raw,
    );
    if (!parsed.success) {
      return {
        ok: false,
        error:
          parsed.error.issues[0]?.message ?? "Check the form and try again.",
      };
    }

    try {
      return { ok: true, data: await options.run(parsed.data, viewer) };
    } catch (error) {
      if (error instanceof Refusal) return { ok: false, error: error.message };
      if (error instanceof Unreachable || error instanceof TypeError)
        return { ok: false, error: messages.unreachable };
      throw error;
    }
  };
}
