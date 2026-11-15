"use client";

import { useActionState, useState } from "react";
import type { ActionResult } from "@/auth/guarded-action";
import { Button } from "@/components/ui/button";
import { Field, inputClass } from "@/components/ui/field";

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
      <div className="space-y-3 border-2 border-ink bg-white p-4">
        <p className="font-semibold">
          Open this link on the desk device now. It won&apos;t be shown again.
        </p>
        <p className="font-mono text-sm break-all">{url}</p>
        <div className="flex flex-wrap gap-3">
          <Button
            variant="outline-dark"
            onClick={async () => {
              await navigator.clipboard.writeText(url);
              setCopied(true);
            }}
          >
            {copied ? "Copied" : "Copy link"}
          </Button>
        </div>
        <p className="text-sm text-smoke">
          Anyone with this link can show the check-in QR, nothing else. If a
          device is lost, switch it off below.
        </p>
      </div>
    );
  }

  return (
    <form action={create} className="max-w-sm">
      <Field label="Device name" hint="So you can tell devices apart later.">
        <input
          name="label"
          required
          maxLength={40}
          placeholder="Front desk tablet"
          className={inputClass}
        />
      </Field>
      <Button type="submit" disabled={pending} className="mt-4">
        {pending ? "Creating…" : "Create desk display link"}
      </Button>
      {result && !result.ok && (
        <p role="alert" className="mt-3 border-l-4 border-ink pl-3">
          {result.error}
        </p>
      )}
    </form>
  );
}
