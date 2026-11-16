"use client";

import { useActionState, type ReactNode } from "react";
import type { ActionResult } from "@/auth/guarded-action";
import { Button } from "@/components/ui/button";

type Variant = "dark" | "outline-dark";

/**
 * A form wired to a guarded Server Action. Shows the action's error, or a
 * success line, right under the button so the result is next to the tap.
 * The success line is the action's own `message` when it returns one (the
 * server knows details like the date a change applies), else `success`.
 * Both props must be plain values: functions can't cross from a Server
 * Component into this client component.
 */
export function ActionForm<T>({
  action,
  submitLabel,
  pendingLabel = "Saving…",
  success,
  variant = "dark",
  className = "",
  children,
}: {
  action: (form: FormData) => Promise<ActionResult<T>>;
  submitLabel: string;
  pendingLabel?: string;
  success?: string;
  variant?: Variant;
  className?: string;
  children?: ReactNode;
}) {
  const [result, submit, pending] = useActionState(
    async (_previous: ActionResult<T> | null, form: FormData) => action(form),
    null,
  );

  return (
    <form action={submit} className={className}>
      {children}
      <div className="mt-4 flex flex-col gap-3">
        <Button
          type="submit"
          variant={variant}
          disabled={pending}
          className="self-start"
        >
          {pending ? pendingLabel : submitLabel}
        </Button>
        {result && !result.ok && (
          <p role="alert" className="callout">
            {result.error}
          </p>
        )}
        {result?.ok && (messageOf(result.data) ?? success) && (
          <p role="status" className="callout">
            {messageOf(result.data) ?? success}
          </p>
        )}
      </div>
    </form>
  );
}

function messageOf(data: unknown): string | null {
  return data &&
    typeof data === "object" &&
    "message" in data &&
    typeof data.message === "string"
    ? data.message
    : null;
}
