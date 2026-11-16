"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import type { CheckInResult } from "@/attendance/actions";
import { codeFromScan } from "@/attendance/code";
import { QrScanner } from "@/attendance/components/qr-scanner";
import type { ActionResult } from "@/auth/guarded-action";
import { Button } from "@/components/ui/button";
import { formatPaise } from "@/lib/money";

type Outcome = ActionResult<CheckInResult> | null;

/**
 * Member check-in. Opened from a desk QR the code is already in the link and
 * goes straight off; opened from the app it starts the camera. iPhones open
 * camera-scanned links in Safari, outside the installed app, which is why
 * the in-app scanner exists.
 */
export function CheckIn({
  initialCode,
  checkIn,
}: {
  initialCode: string | null;
  checkIn: (input: { code: string }) => Promise<ActionResult<CheckInResult>>;
}) {
  const [outcome, setOutcome] = useState<Outcome>(null);
  const [scanning, setScanning] = useState(false);
  const [pending, startTransition] = useTransition();
  const sentInitial = useRef(false);

  const send = useCallback(
    (code: string) => {
      setScanning(false);
      startTransition(async () => setOutcome(await checkIn({ code })));
    },
    [checkIn],
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
          <Button variant="outline-dark" onClick={() => setScanning(false)}>
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
