"use client";

import { useRef } from "react";
import { NavIconSvg } from "@/components/nav/nav-icons";
import { Meter } from "@/components/ui/viz";
import { readCrowd, type CrowdLevel } from "@/bulletin/crowd";
import { getOpenStatus } from "@/bulletin/hours";
import { useBulletin, useMinuteClock } from "@/bulletin/use-bulletin";
import { useCrowd } from "@/bulletin/use-crowd";

const HINT: Record<CrowdLevel, string> = {
  Quiet: "Plenty of room. Estimated from recent check-ins.",
  Moderate: "A steady crowd. Estimated from recent check-ins.",
  Busy: "Expect to share kit. Estimated from recent check-ins.",
};

/**
 * How busy the gym is now: Quiet, Moderate or Busy, with a bar. Worked out
 * on the phone from recent check-in times (crowd.json) and the owner's
 * settings (bulletin.json), and re-worked every minute without fetching, so
 * it eases off as people leave. Never shows a headcount.
 */
export function CrowdCard({ className = "" }: { className?: string }) {
  const card = useRef<HTMLElement>(null);
  const crowd = useCrowd(card);
  const data = useBulletin();
  const now = useMinuteClock();

  const status = data ? getOpenStatus(data, now) : null;
  const reading =
    data && crowd && status?.state === "open"
      ? readCrowd(crowd.checkins, data.crowd, now)
      : null;

  const level = !status
    ? null
    : status.state === "closed"
      ? "Closed"
      : (reading?.level ?? null);

  return (
    <section
      ref={card}
      aria-label="How busy the gym is"
      aria-live="polite"
      className={`flex flex-col card p-5 sm:p-6 ${className}`}
    >
      <h2 className="flex items-center gap-2 text-sm font-medium">
        <NavIconSvg icon="members" className="size-4" />
        Crowd now
      </h2>
      <p className="mt-3 text-3xl font-semibold tracking-tight">
        {level ?? <span className="text-muted">…</span>}
      </p>
      <Meter
        className="mt-4"
        value={reading ? reading.share * 100 : 0}
        max={100}
        label={level ? `Crowd: ${level}` : "Crowd: loading"}
      />
      <p className="mt-3 text-sm text-muted">
        {status?.state === "closed"
          ? status.label
          : reading
            ? HINT[reading.level]
            : "Checking…"}
      </p>
    </section>
  );
}
