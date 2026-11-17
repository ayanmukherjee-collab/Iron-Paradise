"use client";

import { useActionState, useState } from "react";
import type { ActionResult } from "@/auth/guarded-action";
import { NavIconSvg } from "@/components/nav/nav-icons";
import { useAfterSave } from "@/components/ui/after-save";
import { Button } from "@/components/ui/button";
import { inputBase } from "@/components/ui/field";

/**
 * Makes a desk display link and shows it once. Only a hash is stored, so it
 * cannot be shown again; open it on the desk device straight away.
 */
export function DeskLinkPanel({
  createDeskDisplay,
}: {
  createDeskDisplay: (form: FormData) => Promise<ActionResult<{ url: string }>>;
}) {
  const afterSave = useAfterSave();
  const [result, create, pending] = useActionState(
    async (_previous: ActionResult<{ url: string }> | null, form: FormData) => {
      const result = await createDeskDisplay(form);
      if (result.ok) afterSave();
      return result;
    },
    null,
  );
  const [copied, setCopied] = useState(false);

  if (result?.ok) {
    const { url } = result.data;
    return (
      <div className="space-y-3 rounded-tile bg-canvas p-4">
        <p className="flex items-center gap-2 text-sm font-semibold">
          <NavIconSvg icon="link" className="size-4" />
          Shown once only
        </p>
        <p className="rounded-control bg-white p-3 font-mono text-xs break-all ring-1 ring-line">
          {url}
        </p>
        <Button
          variant="outline-dark"
          className="w-full"
          onClick={async () => {
            await navigator.clipboard.writeText(url);
            setCopied(true);
          }}
        >
          {copied ? "Copied" : "Copy link"}
        </Button>
      </div>
    );
  }

  return (
    <form action={create}>
      <div className="flex flex-col gap-2 sm:flex-row">
        <label className="sr-only" htmlFor="desk-label">
          Device name
        </label>
        <input
          id="desk-label"
          name="label"
          required
          maxLength={40}
          placeholder="New device name"
          className={`${inputBase} sm:flex-1`}
        />
        <Button type="submit" disabled={pending} className="shrink-0">
          <NavIconSvg icon="plus" className="size-4" />
          {pending ? "Creating…" : "Add"}
        </Button>
      </div>
      {result && !result.ok && (
        <p role="alert" className="mt-3 callout text-sm">
          {result.error}
        </p>
      )}
    </form>
  );
}
