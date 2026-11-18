"use client";

import Link from "@/components/ui/link";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import type { CheckInResult } from "@/attendance/types";
import { codeFromScan } from "@/attendance/code";
import { QrScanner } from "@/attendance/components/qr-scanner";
import type { ActionResult } from "@/auth/action-result";
import { useAfterSave } from "@/components/ui/after-save";
import { Button } from "@/components/ui/button";
import { formatPaise } from "@/lib/money";
import { retryOnThrow } from "@/lib/retry";

type Outcome = ActionResult<CheckInResult> | null;

const unreachable =
  "Couldn't reach the gym's server. Scan again in a moment, or ask the front desk to mark you in.";

/**
 * Member check-in. Opened from a desk QR the code is already in the link and
 * goes straight off; opened from the app the camera is already on, so the
 * QR button in the nav is one tap to scanning. iPhones open
 * camera-scanned links in Safari, outside the installed app, which is why
 * the in-app scanner exists.
 */
export function CheckIn({
  initialCode,
  checkIn,
  onCancel,
}: {
  initialCode: string | null;
  checkIn: (input: { code: string }) => Promise<ActionResult<CheckInResult>>;
  /** Where Cancel goes from the first scan; without it, Cancel just stops. */
  onCancel?: () => void;
}) {
  const [outcome, setOutcome] = useState<Outcome>(null);
  const [scanning, setScanning] = useState(!initialCode);
  const [pending, startTransition] = useTransition();
  const sentInitial = useRef(false);
  const afterSave = useAfterSave();

  const send = useCallback(
    (code: string) => {
      setScanning(false);
      startTransition(async () => {
        // When many members scan at once the server can turn a request away
        // (503). A check-in is safe to send again, since the database ignores
        // a second one the same day, so try twice more before giving up.
        try {
          const outcome = await retryOnThrow(
            () => checkIn({ code }),
            [1000, 3000],
          );
          setOutcome(outcome);
          if (outcome.ok) afterSave();
        } catch {
          setOutcome({ ok: false, error: unreachable });
        }
      });
    },
    [checkIn, afterSave],
  );

  useEffect(() => {
    if (!initialCode || sentInitial.current) return;
    sentInitial.current = true;
    send(initialCode);
  }, [initialCode, send]);

  const onScan = useCallback(
    (text: string) => {
      const code = codeFromScan(text, window.location.origin);
      if (code) send(code);
      return code !== null;
    },
    [send],
  );

  if (pending) {
    return (
      <p role="status" className="page-title">
        Checking you in…
      </p>
    );
  }

  if (outcome?.ok) {
    const { status, firstName, owedPaise } = outcome.data;
    return (
      <div role="status" className="space-y-6">
        <div className="card-dark p-6 sm:p-7">
          <p className="page-title">
            {status === "checked_in" ? "You're in" : "Already in"}
          </p>
          <p className="mt-2 text-lg text-mist">
            {status === "checked_in"
              ? `Have a good session, ${firstName}.`
              : `You checked in earlier today, ${firstName}. Once a day is all it takes.`}
          </p>
        </div>
        {owedPaise > 0 && (
          <p className="callout text-lg">
            {formatPaise(owedPaise)} fee due. Pay at the front desk when you get
            a moment.
          </p>
        )}
        <Link
          href="/app"
          className="inline-flex font-semibold underline decoration-line underline-offset-4 hover:decoration-ink"
        >
          See your visits
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {outcome && !outcome.ok && (
        <p role="alert" className="callout text-lg">
          {outcome.error}
        </p>
      )}
      {scanning ? (
        <>
          <QrScanner onScan={onScan} />
          <p className="text-center text-muted">
            Point the camera at the QR on the front desk.
          </p>
          <Button
            variant="outline-dark"
            className="w-full sm:w-auto"
            onClick={() =>
              onCancel && !outcome ? onCancel() : setScanning(false)
            }
          >
            Cancel
          </Button>
        </>
      ) : (
        <Button onClick={() => setScanning(true)} className="w-full sm:w-auto">
          {outcome ? "Scan again" : "Scan the desk QR"}
        </Button>
      )}
    </div>
  );
}
