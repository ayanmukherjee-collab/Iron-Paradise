// The two training batches. The database refuses check-ins outside them
// (see the check_in_batches migration); this mirrors its rule so pages can
// label each visit and say whether check-in is open right now.

export type Batch = "morning" | "evening";

/** Opening and closing times in gym time, "HH:MM:SS" as Postgres sends them. */
export interface Batches {
  morningOpens: string;
  morningCloses: string;
  eveningOpens: string;
  eveningCloses: string;
}

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

/** Pads "5:00" or "05:00" to "05:00:00" so times compare as text. */
function full(time: string): string {
  const [hours = "0", minutes = "0", seconds = "0"] = time.split(":");
  return [hours, minutes, seconds]
    .map((part) => part.padStart(2, "0"))
    .join(":");
}

/** Which batch a moment falls in; opening inclusive, closing exclusive. */
export function batchAt(moment: Date, batches: Batches): Batch | null {
  const clock = gymClock(moment);
  if (
    clock >= full(batches.morningOpens) &&
    clock < full(batches.morningCloses)
  )
    return "morning";
  if (
    clock >= full(batches.eveningOpens) &&
    clock < full(batches.eveningCloses)
  )
    return "evening";
  return null;
}

/** "5 am", "4:30 pm", "midnight". */
export function formatClock(time: string): string {
  const [hours, minutes] = full(time).split(":").map(Number);
  if (hours % 24 === 0 && minutes === 0) return "midnight";
  const suffix = hours % 24 < 12 ? "am" : "pm";
  const hour12 = hours % 12 === 0 ? 12 : hours % 12;
  return minutes === 0
    ? `${hour12} ${suffix}`
    : `${hour12}:${String(minutes).padStart(2, "0")} ${suffix}`;
}

/** "5 am – 11 am" for one batch. */
export function batchHours(batches: Batches, batch: Batch): string {
  return batch === "morning"
    ? `${formatClock(batches.morningOpens)} – ${formatClock(batches.morningCloses)}`
    : `${formatClock(batches.eveningOpens)} – ${formatClock(batches.eveningCloses)}`;
}

/** "HH:MM" for a time input's value. */
export function toTimeInput(time: string): string {
  return full(time).slice(0, 5);
}
