import type { HoursRow } from "@/content/landing";

/** The gym's clock: hours are in India time wherever the page is rendered. */
const GYM_TIME_ZONE = "Asia/Kolkata";

export const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** The time at the gym: hours since midnight (16.5 is 4:30 PM), day 0 = Sunday. */
export type GymNow = { hour: number; day: number };

export function gymNow(now: Date): GymNow {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: GYM_TIME_ZONE,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const part = (type: string) =>
    parts.find((p) => p.type === type)?.value ?? "";
  return {
    hour: Number(part("hour")) + Number(part("minute")) / 60,
    day: Math.max(0, DAY_SHORT.indexOf(part("weekday"))),
  };
}

export type OpenStatus =
  | { open: true; row: HoursRow }
  /** `day` is null when the next session is later today. */
  | { open: false; next: HoursRow; day: number | null };

/** Whether the doors are open now, and which session is current or next. */
export function openStatus(
  rows: HoursRow[],
  now: GymNow,
  closedDays: number[] = [],
): OpenStatus {
  const sorted = [...rows].sort((a, b) => a.from - b.from);
  if (!closedDays.includes(now.day)) {
    const current = sorted.find(
      (row) => now.hour >= row.from && now.hour < row.to,
    );
    if (current) return { open: true, row: current };
    const later = sorted.find((row) => row.from > now.hour);
    if (later) return { open: false, next: later, day: null };
  }
  // Done for today (or shut all day): the first session of the next open day.
  for (let ahead = 1; ahead <= 7; ahead++) {
    const day = (now.day + ahead) % 7;
    if (!closedDays.includes(day)) return { open: false, next: sorted[0], day };
  }
  return { open: false, next: sorted[0], day: null };
}

/** "10 PM", "5 AM": hour-only labels for the status chip. */
export function hourLabel(hour: number): string {
  const whole = Math.floor(hour) % 24;
  const suffix = whole < 12 ? "AM" : "PM";
  return `${whole % 12 || 12} ${suffix}`;
}
