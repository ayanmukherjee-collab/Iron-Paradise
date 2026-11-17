"use client";

import { useEffect, useState } from "react";
import { checkInUrl } from "@/attendance/code";
import { QrCode } from "@/members/components/qr-code";

type Shown =
  | { kind: "loading" }
  | { kind: "code"; code: string; until: number }
  | { kind: "off"; message: string }
  | { kind: "offline" };

/**
 * The desk display: a big QR that changes every 30 seconds. It asks the
 * server for the next code just after each change, keeps the screen awake
 * where the browser allows, and recovers on its own after a dropped network.
 */
export type DeskCode =
  { code: string; secondsLeft: number } | { error: string };

/** The server's code endpoint (src/app/desk/[token]/code). */
async function fetchDeskCode(token: string): Promise<DeskCode> {
  const response = await fetch(`/desk/${encodeURIComponent(token)}/code`, {
    cache: "no-store",
  });
  return (await response.json()) as DeskCode;
}

export function DeskScreen({
  token,
  origin,
  loadCode = fetchDeskCode,
}: {
  token: string;
  origin: string;
  /** Where the next code comes from; the static app asks the database. */
  loadCode?: (token: string) => Promise<DeskCode>;
}) {
  const [shown, setShown] = useState<Shown>({ kind: "loading" });
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let cancelled = false;

    async function refresh() {
      try {
        const body = await loadCode(token);
        if (cancelled) return;
        if ("error" in body) {
          setShown({ kind: "off", message: body.error });
          // A switched-off link stays off; check rarely in case of a mistake.
          timer = setTimeout(refresh, 60_000);
          return;
        }
        setShown({
          kind: "code",
          code: body.code,
          until: Date.now() + body.secondsLeft * 1000,
        });
        timer = setTimeout(refresh, body.secondsLeft * 1000 + 300);
      } catch {
        if (cancelled) return;
        setShown({ kind: "offline" });
        timer = setTimeout(refresh, 5_000);
      }
    }

    refresh();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [token, loadCode]);

  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(tick);
  }, []);

  // A desk tablet that dims and locks would hide the QR.
  useEffect(() => {
    let lock: { release(): Promise<void> } | null = null;
    const wakeLock = (
      navigator as {
        wakeLock?: { request(type: "screen"): Promise<typeof lock> };
      }
    ).wakeLock;
    const keepAwake = () => {
      if (document.visibilityState === "visible")
        wakeLock
          ?.request("screen")
          .then((granted) => (lock = granted))
          .catch(() => undefined);
    };
    keepAwake();
    document.addEventListener("visibilitychange", keepAwake);
    return () => {
      document.removeEventListener("visibilitychange", keepAwake);
      lock?.release().catch(() => undefined);
    };
  }, []);

  if (shown.kind === "off") {
    return <p className="max-w-md text-center text-2xl">{shown.message}</p>;
  }
  if (shown.kind === "offline") {
    return (
      <p role="status" className="max-w-md text-center text-2xl">
        No connection. Trying again… Members can be marked in by staff
        meanwhile.
      </p>
    );
  }
  if (shown.kind === "loading") {
    return (
      <p role="status" className="text-2xl">
        Loading…
      </p>
    );
  }

  const secondsLeft = Math.max(0, Math.ceil((shown.until - now) / 1000));
  return (
    <div className="flex w-full max-w-lg flex-col items-center gap-6">
      <QrCode
        value={checkInUrl(shown.code, origin)}
        label="Check-in QR code. Scan it with the Iron Paradise app."
        className="aspect-square w-full max-w-[min(80vw,70vh)] border-8 border-white"
      />
      <div className="h-2 w-full max-w-[min(80vw,70vh)] bg-ash">
        <div
          className="h-full bg-white transition-[width] duration-1000 ease-linear"
          style={{ width: `${(secondsLeft / 30) * 100}%` }}
        />
      </div>
    </div>
  );
}
