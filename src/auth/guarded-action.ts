import "server-only";
import { unstable_rethrow } from "next/navigation";
import type { z } from "zod";
import type { Action } from "@/auth/permissions";
import { getViewer, viewerCan, type Viewer } from "@/auth/session";

export type ActionResult<T = void> =
  { ok: true; data: T } | { ok: false; error: string };

const messages = {
  signedOut: "Your session ended. Sign in again.",
  forbidden: "You don't have access to do that.",
  duplicate: "That already exists.",
} as const;

/**
 * Wraps a Server Action so it always runs the brief's four steps in order:
 * check the session, check the permission, validate input with Zod, then act.
 * Server Actions are public HTTP endpoints, so none of these steps can be
 * skipped because a page "already checked".
 */
export function guardedAction<Schema extends z.ZodType, T>(options: {
  permission: Action;
  input: Schema;
  run: (input: z.infer<Schema>, viewer: Viewer) => Promise<T>;
}): (raw: unknown) => Promise<ActionResult<T>> {
  return async (raw) => {
    const viewer = await getViewer();
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
      // redirect() and notFound() work by throwing; let Next.js handle them.
      unstable_rethrow(error);
      const message = databaseErrorMessage(error);
      if (message) return { ok: false, error: message };
      throw error;
    }
  };
}

/**
 * Turns expected database refusals into messages a person can act on.
 * Messages raised by our own SQL functions are written for users; raw RLS and
 * privilege errors are not, so they get a generic line. Anything else is a bug
 * and is rethrown.
 */
export function databaseErrorMessage(error: unknown): string | null {
  const pgError = findPostgresError(error);
  if (!pgError) return null;

  switch (pgError.code) {
    case "42501":
      return /row-level security|permission denied/.test(pgError.message)
        ? messages.forbidden
        : pgError.message;
    case "23505":
      return messages.duplicate;
    case "P0001":
    case "P0002":
    case "22023":
      return pgError.message;
    default:
      return null;
  }
}

function findPostgresError(
  error: unknown,
): { code: string; message: string } | null {
  let current: unknown = error;
  for (let depth = 0; current && depth < 3; depth++) {
    const candidate = current as {
      code?: unknown;
      message?: unknown;
      cause?: unknown;
    };
    if (
      typeof candidate.code === "string" &&
      typeof candidate.message === "string"
    ) {
      return { code: candidate.code, message: candidate.message };
    }
    current = candidate.cause;
  }
  return null;
}
