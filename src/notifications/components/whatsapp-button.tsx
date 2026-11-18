"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { NavIconSvg } from "@/components/nav/nav-icons";
import { logWhatsAppReminder } from "@/notifications/actions";

const linkClass =
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-control px-5 text-sm font-semibold transition-colors";

/**
 * Opens WhatsApp with the reminder typed in and logs it as sent. A plain
 * link, so the browser opens WhatsApp straight from the tap (a link opened
 * later from script would be blocked as a pop-up); logging runs alongside.
 * `compact` draws only a send icon, for rows in a list.
 */
export function WhatsAppButton({
  href,
  membershipId,
  label = "WhatsApp",
  onSent,
  compact = false,
}: {
  href: string;
  membershipId: string;
  label?: string;
  onSent?: () => void;
  compact?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <span
      className={`inline-flex flex-col gap-1 ${compact ? "items-end" : ""}`}
    >
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
        aria-label={compact ? `${label}: send reminder` : undefined}
        title={compact ? "Send on WhatsApp" : undefined}
        className={
          compact
            ? "flex size-11 shrink-0 items-center justify-center rounded-control bg-ink text-white transition-colors hover:bg-graphite"
            : `${linkClass} bg-ink text-white hover:bg-graphite`
        }
      >
        {compact ? (
          <NavIconSvg
            icon="send"
            className={`size-5 ${pending ? "motion-safe:animate-pulse" : ""}`}
          />
        ) : pending ? (
          "Logging…"
        ) : (
          label
        )}
      </a>
      {error && (
        <span role="alert" className="max-w-48 text-right text-xs">
          {error}
        </span>
      )}
    </span>
  );
}
