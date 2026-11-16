"use client";

import { useActionState, useState } from "react";
import type { ActionResult } from "@/auth/guarded-action";
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
  const [result, create, pending] = useActionState(
    async (_previous: ActionResult<{ url: string }> | null, form: FormData) =>
      createDeskDisplay(form),
    null,
  );
  const [copied, setCopied] = useState(false);

  if (result?.ok) {
    const { url } = result.data;
    return (
      <div className="space-y-3 rounded-tile bg-canvas p-4">
        <p className="text-sm font-semibold">
          Open this link on the desk device now. It won&apos;t be shown again.
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
        <p className="text-xs text-muted">
          Anyone with this link can show the check-in QR, nothing else. If a
          device is lost, switch it off above.
        </p>
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
          placeholder="Device name, e.g. Front desk tablet"
          className={`${inputBase} sm:flex-1`}
        />
        <Button type="submit" disabled={pending} className="shrink-0">
          {pending ? "Creating…" : "Create link"}
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
