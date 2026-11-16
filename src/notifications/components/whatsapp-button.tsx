"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { logWhatsAppReminder } from "@/notifications/actions";

const linkClass =
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-control px-5 text-sm font-semibold transition-colors";

/**
 * Opens WhatsApp with the reminder typed in and logs it as sent. A plain
 * link, so the browser opens WhatsApp straight from the tap (a link opened
 * later from script would be blocked as a pop-up); logging runs alongside.
 */
export function WhatsAppButton({
  href,
  membershipId,
  label = "WhatsApp",
  onSent,
}: {
  href: string;
  membershipId: string;
  label?: string;
  onSent?: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <span className="inline-flex flex-col gap-1">
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        aria-disabled={pending}
        onClick={() => {
          setError(null);
          onSent?.();
          startTransition(async () => {
            const result = await logWhatsAppReminder({ membershipId });
            if (!result.ok) setError(result.error);
            router.refresh();
          });
        }}
        className={`${linkClass} bg-ink text-white hover:bg-graphite`}
      >
        {pending ? "Logging…" : label}
      </a>
      {error && (
        <span role="alert" className="text-sm">
          {error}
        </span>
      )}
    </span>
  );
}
