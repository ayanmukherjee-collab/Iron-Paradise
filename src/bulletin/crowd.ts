// The crowd meter, worked out on the phone from crowd.json (recent check-in
// times) and bulletin.json (the owner's settings). Pure functions, so the
// meter keeps fading people out every minute without fetching anything, and
// so they can be tested without a clock.
//
// Members only ever see a level and a bar, never a headcount.

import { z } from "zod";
import type { CrowdSettings } from "@/bulletin/types";

/** The shape of crowd.json (built by public.crowd_after_check_in). */
export const crowdFile = z.object({
  generatedAt: z.iso.datetime(),
  /** Check-in times of the last two hours, to the minute. Nothing else. */
  checkins: z.array(z.iso.datetime()).max(2000),
});
export type CrowdFile = z.infer<typeof crowdFile>;

/**
 * How much one check-in still counts: one person for its first
 * `fullMinutes`, then fading linearly to nothing by `goneMinutes`, as
 * people finish and leave.
 */
export function presenceWeight(
  minutesAgo: number,
  fullMinutes = 45,
  goneMinutes = 120,
): number {
  if (minutesAgo < 0) return 0;
  if (minutesAgo <= fullMinutes) return 1;
  if (minutesAgo >= goneMinutes) return 0;
  return 1 - (minutesAgo - fullMinutes) / (goneMinutes - fullMinutes);
}

/**
 * Roughly how many people are in now. The multiplier makes up for members
 * who don't scan. Not for display: it feeds the level and the bar.
 */
export function estimateCrowd(
  checkins: readonly string[],
  settings: CrowdSettings,
  now: Date,
): number {
  const nowMs = now.getTime();
  let present = 0;
  for (const at of checkins) {
    const minutesAgo = (nowMs - Date.parse(at)) / 60_000;
    present += presenceWeight(
      minutesAgo,
      settings.fullMinutes,
      settings.goneMinutes,
    );
  }
  return present * settings.calibrationMultiplier;
}

export type CrowdLevel = "Quiet" | "Moderate" | "Busy";

/** Under 30% of comfortable capacity is Quiet, over 70% is Busy. */
export function crowdLevel(estimate: number, capacity: number): CrowdLevel {
  const share = capacity > 0 ? estimate / capacity : 1;
  if (share < 0.3) return "Quiet";
  if (share > 0.7) return "Busy";
  return "Moderate";
}

export interface CrowdReading {
  level: CrowdLevel;
  /** How full, 0 to 1, for the bar. */
  share: number;
}

export function readCrowd(
  checkins: readonly string[],
  settings: CrowdSettings,
  now: Date,
): CrowdReading {
  const estimate = estimateCrowd(checkins, settings, now);
  const capacity = settings.comfortableCapacity;
  return {
    level: crowdLevel(estimate, capacity),
    share: Math.min(1, Math.max(0, estimate / capacity)),
  };
}
