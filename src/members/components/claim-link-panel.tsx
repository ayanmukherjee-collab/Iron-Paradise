"use client";

import { useActionState, useState } from "react";
import type { ActionResult } from "@/auth/guarded-action";
import { Button } from "@/components/ui/button";
import { QrCode } from "@/members/components/qr-code";
import { whatsAppLink } from "@/members/phone";

type ClaimLink = { url: string; expiresAt: string };

const expiry = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "Asia/Kolkata",
});

/**
 * Creates a claim link and shows it once. Only a hash is stored, so after
 * leaving this page the link cannot be shown again; making a new one cancels
 * the old.
 */
export function ClaimLinkPanel({
  memberId,
  firstName,
  phone,
  gymName,
  hasOpenLink,
  createClaimLink,
}: {
  memberId: string;
  firstName: string;
  phone: string;
  gymName: string;
  hasOpenLink: boolean;
  createClaimLink: (input: {
    memberId: string;
  }) => Promise<ActionResult<ClaimLink>>;
}) {
  const [result, create, pending] = useActionState(
    async () => createClaimLink({ memberId }),
    null as ActionResult<ClaimLink> | null,
  );
  const [copied, setCopied] = useState(false);
  const link = result?.ok ? result.data : null;

  if (!link) {
    return (
      <form action={create}>
        <Button type="submit" disabled={pending}>
          {pending
            ? "Creating…"
            : hasOpenLink
              ? "Make a new claim link"
              : "Create claim link"}
        </Button>
        {hasOpenLink && (
          <p className="mt-2 text-sm text-smoke">
            A new link cancels the one already sent.
          </p>
        )}
        {result && !result.ok && (
          <p role="alert" className="mt-3 border-l-4 border-ink pl-3">
            {result.error}
          </p>
        )}
      </form>
    );
  }

  const message = `Hi ${firstName}, this is ${gymName}. Tap this link and sign in with Google to see your membership, visits and payments: ${link.url}`;

  return (
    <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
      <QrCode
        value={link.url}
        label="Claim link QR code"
        className="size-48 shrink-0 border-2 border-ink"
      />
      <div className="min-w-0 space-y-3">
        <p className="text-sm text-smoke">
          Works once, until {expiry.format(new Date(link.expiresAt))}. It
          won&apos;t be shown again after you leave this page.
        </p>
        <p className="font-mono text-sm break-all">{link.url}</p>
        <div className="flex flex-wrap gap-3">
          <a
            href={whatsAppLink(phone, message)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-12 items-center bg-ink px-6 text-sm font-bold tracking-[0.08em] text-white uppercase hover:bg-ash"
          >
            Send on WhatsApp
          </a>
          <Button
            variant="outline-dark"
            onClick={async () => {
              await navigator.clipboard.writeText(link.url);
              setCopied(true);
            }}
          >
            {copied ? "Copied" : "Copy link"}
          </Button>
        </div>
      </div>
    </div>
  );
}
