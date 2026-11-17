"use client";

import { useRef } from "react";
import { NavIconSvg } from "@/components/nav/nav-icons";
import { readCrowd } from "@/bulletin/crowd";
import { CrowdZones } from "@/bulletin/components/crowd-charts";
import { getOpenStatus } from "@/bulletin/hours";
import { useBulletin, useMinuteClock } from "@/bulletin/use-bulletin";
import { useCrowd } from "@/bulletin/use-crowd";

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
        Crowd
      </h2>
      <p className="mt-3 flex items-baseline gap-2">
        <span className="text-3xl font-semibold tracking-tight">
          {level ?? <span className="text-muted">…</span>}
        </span>
        {status?.state === "closed" && (
          <span className="text-sm text-muted">
            {status.label.replace(/^Closed( · )?/, "")}
          </span>
        )}
      </p>
      <CrowdZones
        className="mt-4"
        share={reading?.share ?? 0}
        label={level ? `Crowd: ${level}` : "Crowd: loading"}
      />
    </section>
  );
}
