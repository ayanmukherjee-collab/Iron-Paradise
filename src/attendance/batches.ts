// The two training batches. They come from the opening hours: on any day,
// the opening that starts before noon is the morning batch and the one that
// starts later is the evening batch (src/bulletin/hours.ts). The database
// refuses check-ins outside them (batch_at in supabase/migrations); this
// mirrors its rule so pages can label each visit and say whether check-in
// is open right now.

import { toMinutes, type Batch, type Batches } from "@/bulletin/hours";
import type { TimeRange } from "@/bulletin/types";

export type { Batch, Batches };

export const batchLabels: Record<Batch, string> = {
  morning: "Morning",
  evening: "Evening",
};

const gymClockFormat = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
  timeZone: "Asia/Kolkata",
});

/** "06:15:00": the gym's wall clock at a moment. */
export function gymClock(moment: Date): string {
  return gymClockFormat.format(moment);
}

function inside(range: TimeRange | null, minutes: number): boolean {
  if (!range) return false;
  const open = toMinutes(range.open);
  const close = toMinutes(range.close);
  // A close earlier than the open runs past midnight.
  return close > open
    ? minutes >= open && minutes < close
    : minutes >= open || minutes < close;
}

/** Which batch a moment falls in; opening inclusive, closing exclusive. */
export function batchAt(moment: Date, batches: Batches): Batch | null {
  const minutes = toMinutes(gymClock(moment));
  if (inside(batches.morning, minutes)) return "morning";
  if (inside(batches.evening, minutes)) return "evening";
  return null;
}

/**
 * The batch a visit counts towards. Usually the batch it fell in; if the
 * hours changed after it (a batch closed later that day), the half of the
 * day it was in.
 */
export function visitBatch(moment: Date, batches: Batches): Batch {
  return (
    batchAt(moment, batches) ??
    (toMinutes(gymClock(moment)) < 12 * 60 ? "morning" : "evening")
  );
}

/** "5 am", "4:30 pm", "midnight". */
export function formatClock(time: string): string {
  const total = toMinutes(time) % (24 * 60);
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  if (total === 0) return "midnight";
  const suffix = hours < 12 ? "am" : "pm";
  const hour12 = hours % 12 === 0 ? 12 : hours % 12;
  return minutes === 0
    ? `${hour12} ${suffix}`
    : `${hour12}:${String(minutes).padStart(2, "0")} ${suffix}`;
}

/** "5 am – 11 am" for one batch, or a dash when it doesn't run. */
export function batchHours(batches: Batches, batch: Batch): string {
  const range = batches[batch];
  return range
    ? `${formatClock(range.open)} – ${formatClock(range.close)}`
    : "—";
}
