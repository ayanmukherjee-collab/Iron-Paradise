// Opening hours, worked out on the phone from bulletin.json. Pure functions
// so they can run anywhere (server, browser) and be tested without a clock.
// Everything is in gym time (Asia/Kolkata), never the device's time zone.
//
// Rules shared with the database (supabase/migrations, batch_at):
// - an opening includes its start minute and excludes its end minute;
// - a close earlier than the open runs past midnight into the next day;
// - a closure replaces that day's weekly hours: hours null shuts the day,
//   an array is the openings that still run;
// - an opening that starts before noon is the morning batch, the rest are
//   the evening batch.

import {
  DAY_KEYS,
  type Bulletin,
  type Closure,
  type TimeRange,
} from "@/bulletin/types";

export type IsoDate = string;

const gymClock = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Kolkata",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** The gym's calendar date and minutes since its midnight at a moment. */
export function gymMoment(now: Date): { date: IsoDate; minutes: number } {
  const part: Record<string, string> = {};
  for (const { type, value } of gymClock.formatToParts(now)) part[type] = value;
  return {
    date: `${part.year}-${part.month}-${part.day}`,
    minutes: Number(part.hour) * 60 + Number(part.minute),
  };
}

export function toMinutes(clock: string): number {
  const [hours, minutes] = clock.split(":").map(Number);
  return hours * 60 + minutes;
}

export function addDays(date: IsoDate, days: number): IsoDate {
  const moment = new Date(`${date}T00:00:00Z`);
  moment.setUTCDate(moment.getUTCDate() + days);
  return moment.toISOString().slice(0, 10);
}

/** 0 = Sunday, as DAY_KEYS. */
function weekday(date: IsoDate): number {
  return new Date(`${date}T00:00:00Z`).getUTCDay();
}

const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** "10 PM", "5:30 AM", "12 AM". */
export function clockLabel(clock: string): string {
  const total = toMinutes(clock);
  const hour = Math.floor(total / 60);
  const minute = total % 60;
  const suffix = hour < 12 ? "AM" : "PM";
  const hour12 = hour % 12 || 12;
  return minute
    ? `${hour12}:${String(minute).padStart(2, "0")} ${suffix}`
    : `${hour12} ${suffix}`;
}

/** "5 AM – 10 AM" */
export function rangeLabel(range: TimeRange): string {
  return `${clockLabel(range.open)} – ${clockLabel(range.close)}`;
}

/** "Fri 20 Nov" */
export function dayLabel(date: IsoDate): string {
  const [, month, day] = date.split("-").map(Number);
  const months = "Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec".split(" ");
  return `${WEEKDAY_SHORT[weekday(date)]} ${day} ${months[month - 1]}`;
}

type HoursSource = Pick<Bulletin, "hours" | "closures">;

/** The openings on a gym date, and the closure that set them, if any. */
export function hoursOn(
  source: HoursSource,
  date: IsoDate,
): { openings: TimeRange[]; closure: Closure | null } {
  const closure = source.closures.find((c) => c.date === date) ?? null;
  if (closure) return { openings: closure.hours ?? [], closure };
  return { openings: source.hours[DAY_KEYS[weekday(date)]], closure: null };
}

function crossesMidnight(range: TimeRange): boolean {
  return toMinutes(range.close) < toMinutes(range.open);
}

/** The opening running at this minute of `date`, counting the night before's. */
export function openingAt(
  source: HoursSource,
  date: IsoDate,
  minutes: number,
): TimeRange | null {
  for (const range of hoursOn(source, date).openings) {
    const open = toMinutes(range.open);
    const close = toMinutes(range.close);
    const inside = crossesMidnight(range)
      ? minutes >= open
      : minutes >= open && minutes < close;
    if (inside) return range;
  }
  for (const range of hoursOn(source, addDays(date, -1)).openings) {
    if (crossesMidnight(range) && minutes < toMinutes(range.close)) {
      return range;
    }
  }
  return null;
}

export type OpenStatus =
  | { state: "open"; closes: string; label: string }
  | {
      state: "closed";
      /** Set when today is a full-day closure. */
      closure: Closure | null;
      /** The next opening, if one is within a week. */
      next: { date: IsoDate; open: string } | null;
      label: string;
    };

/**
 * Open or closed right now, with the line members see:
 * "Open now · closes 10 PM", "Closed · opens 5:30 AM",
 * "Closed · opens 5 AM tomorrow", "Closed today: Diwali".
 */
export function getOpenStatus(source: HoursSource, now: Date): OpenStatus {
  const { date, minutes } = gymMoment(now);

  const current = openingAt(source, date, minutes);
  if (current) {
    return {
      state: "open",
      closes: current.close,
      label: `Open now · closes ${clockLabel(current.close)}`,
    };
  }

  const today = hoursOn(source, date);
  const next = nextOpening(source, date, minutes);
  if (today.closure && today.closure.hours === null) {
    const reason = today.closure.reason.trim();
    return {
      state: "closed",
      closure: today.closure,
      next,
      label: reason ? `Closed today: ${reason}` : "Closed today",
    };
  }

  if (!next) return { state: "closed", closure: null, next, label: "Closed" };
  const when =
    next.date === date
      ? ""
      : next.date === addDays(date, 1)
        ? " tomorrow"
        : ` ${WEEKDAY_SHORT[weekday(next.date)]}`;
  return {
    state: "closed",
    closure: null,
    next,
    label: `Closed · opens ${clockLabel(next.open)}${when}`,
  };
}

function nextOpening(
  source: HoursSource,
  date: IsoDate,
  minutes: number,
): { date: IsoDate; open: string } | null {
  for (let ahead = 0; ahead <= 7; ahead++) {
    const day = addDays(date, ahead);
    const opens = hoursOn(source, day)
      .openings.map((range) => range.open)
      .filter((open) => ahead > 0 || toMinutes(open) > minutes)
      .sort();
    if (opens.length) return { date: day, open: opens[0] };
  }
  return null;
}

/** Closures from today to `days` days ahead, soonest first, for the banner. */
export function closuresWithin(
  source: HoursSource,
  now: Date,
  days: number,
): Closure[] {
  const today = gymMoment(now).date;
  const last = addDays(today, days);
  return source.closures
    .filter((c) => c.date >= today && c.date <= last)
    .sort((a, b) => a.date.localeCompare(b.date));
}

// ---- Batches -------------------------------------------------------------

export type Batch = "morning" | "evening";

export interface Batches {
  morning: TimeRange | null;
  evening: TimeRange | null;
}

export function batchOf(range: TimeRange): Batch {
  return toMinutes(range.open) < 12 * 60 ? "morning" : "evening";
}

/** A day's openings as its morning and evening batch (first of each). */
export function splitBatches(openings: TimeRange[]): Batches {
  return {
    morning: openings.find((range) => batchOf(range) === "morning") ?? null,
    evening: openings.find((range) => batchOf(range) === "evening") ?? null,
  };
}

/** Which of a day's usual batches a closure shuts. */
export function closedBatches(
  usual: TimeRange[],
  closure: Pick<Closure, "hours"> | null,
): Record<Batch, boolean> {
  const regular = splitBatches(usual);
  if (!closure) return { morning: false, evening: false };
  if (closure.hours === null)
    return { morning: !!regular.morning, evening: !!regular.evening };
  const left = splitBatches(closure.hours);
  return {
    morning: !!regular.morning && !left.morning,
    evening: !!regular.evening && !left.evening,
  };
}

/**
 * The closure that shuts the chosen batches of a day: "open" when none are
 * shut, hours null when nothing is left, else the openings that still run.
 */
export function closureFor(
  usual: TimeRange[],
  shut: Record<Batch, boolean>,
): "open" | { hours: TimeRange[] | null } {
  const left = usual.filter((range) => !shut[batchOf(range)]);
  if (left.length === usual.length) return "open";
  return { hours: left.length ? left : null };
}
