"use client";

import { useActionState, useEffect, useState, type ReactNode } from "react";
import type { ActionResult } from "@/auth/action-result";
import { NavIconSvg, type NavIcon } from "@/components/nav/nav-icons";
import { useAfterSave } from "@/components/ui/after-save";

/**
 * A single tap that runs a guarded Server Action: an icon, no words. The
 * label is the button's accessible name and its hover title. With
 * `confirm`, the first tap arms it (the icon turns into a tick) and only a
 * second tap within five seconds runs it, for things that can't be undone.
 * The page refreshes after a successful save; an error shows under it.
 */
export function IconAction({
  action,
  fields,
  icon,
  label,
  pressed,
  disabled,
  confirm,
  className = "",
  children,
}: {
  action: (form: FormData) => Promise<ActionResult<unknown>>;
  /** Hidden inputs sent with the tap. */
  fields: Record<string, string>;
  icon: NavIcon;
  label: string;
  /** For toggles: true shows the on state to screen readers. */
  pressed?: boolean;
  disabled?: boolean;
  confirm?: boolean;
  className?: string;
  /** Drawn inside the button, under the icon. */
  children?: ReactNode;
}) {
  const afterSave = useAfterSave();
  const [armed, setArmed] = useState(false);
  const [result, submit, saving] = useActionState(
    async (_previous: ActionResult<unknown> | null, form: FormData) => {
      const result = await action(form);
      if (result.ok) afterSave(result.data);
      return result;
    },
    null,
  );

  useEffect(() => {
    if (!armed) return;
    const timer = setTimeout(() => setArmed(false), 5000);
    return () => clearTimeout(timer);
  }, [armed]);

  return (
    <form
      action={submit}
      onSubmit={(event) => {
        if (confirm && !armed) {
          event.preventDefault();
          setArmed(true);
        }
      }}
      className="contents"
    >
      {Object.entries(fields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <button
        type="submit"
        disabled={disabled || saving}
        aria-label={armed ? `${label}: tap again to confirm` : label}
        aria-pressed={pressed}
        title={label}
        className={`${className} ${armed ? "bg-ink! text-white! ring-ink!" : ""}`}
      >
        <NavIconSvg
          icon={armed ? "check" : icon}
          className={`size-5 shrink-0 ${saving ? "motion-safe:animate-pulse" : ""}`}
        />
        {children}
      </button>
      {result && !result.ok && (
        <p role="alert" className="col-span-full callout text-sm">
          {result.error}
        </p>
      )}
    </form>
  );
}
