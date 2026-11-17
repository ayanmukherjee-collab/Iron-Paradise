"use client";

import { useActionState, type ReactNode } from "react";
import type { ActionResult } from "@/auth/action-result";
import { NavIconSvg, type NavIcon } from "@/components/nav/nav-icons";
import { redirectOf, useAfterSave } from "@/components/ui/after-save";
import { Button } from "@/components/ui/button";

type Variant = "dark" | "outline-dark";

/**
 * A form wired to a guarded Server Action. Shows the action's error, or a
 * success line, right under the button so the result is next to the tap.
 * The success line is the action's own `message` when it returns one (the
 * server knows details like the date a change applies), else `success`.
 * Both props must be plain values: functions can't cross from a Server
 * Component into this client component. After a successful save it
 * refreshes the page, or opens the page the action named (see after-save).
 */
export function ActionForm<T>({
  action,
  submitLabel,
  pendingLabel = "Saving…",
  success,
  variant = "dark",
  icon,
  className = "",
  children,
}: {
  action: (form: FormData) => Promise<ActionResult<T>>;
  submitLabel: string;
  pendingLabel?: string;
  success?: string;
  variant?: Variant;
  /** Shows only this icon on the button; submitLabel becomes its name. */
  icon?: NavIcon;
  className?: string;
  children?: ReactNode;
}) {
  const afterSave = useAfterSave();
  const [result, submit, saving] = useActionState(
    async (_previous: ActionResult<T> | null, form: FormData) => {
      const result = await action(form);
      if (result.ok) afterSave(result.data);
      return result;
    },
    null,
  );
  // Saved and on the way to another page: keep the button busy so the form
  // can't be sent twice before the page changes.
  const pending = saving || (!!result?.ok && redirectOf(result.data) !== null);

  return (
    <form action={submit} className={className}>
      {children}
      <div className="mt-4 flex flex-col gap-3">
        {icon ? (
          <Button
            type="submit"
            variant={variant}
            disabled={pending}
            aria-label={submitLabel}
            title={submitLabel}
            className="size-11 self-start px-0!"
          >
            <NavIconSvg
              icon={icon}
              className={`size-5 ${pending ? "motion-safe:animate-pulse" : ""}`}
            />
          </Button>
        ) : (
          <Button
            type="submit"
            variant={variant}
            disabled={pending}
            className="self-start"
          >
            {pending ? pendingLabel : submitLabel}
          </Button>
        )}
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
