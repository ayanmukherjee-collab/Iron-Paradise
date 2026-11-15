// Calendar dates are plain "YYYY-MM-DD" strings in the gym's local calendar
// (Asia/Kolkata). They carry no time or zone, so they cannot drift a day
// when the server runs in UTC.

export type IsoDate = string;

const isoPattern = /^(\d{4})-(\d{2})-(\d{2})$/;
const dayMs = 86_400_000;

function toEpochDay(date: IsoDate): number {
  const match = isoPattern.exec(date);
  if (!match) throw new RangeError(`Not a YYYY-MM-DD date: ${date}`);
  return (
    Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])) / dayMs
  );
}

function fromEpochDay(day: number): IsoDate {
  return new Date(day * dayMs).toISOString().slice(0, 10);
}

export function isIsoDate(value: string): boolean {
  if (!isoPattern.test(value)) return false;
  return fromEpochDay(toEpochDay(value)) === value;
}

export function addDays(date: IsoDate, days: number): IsoDate {
  return fromEpochDay(toEpochDay(date) + days);
}

/** Whole days from `from` to `to` (negative when `to` is earlier). */
export function daysBetween(from: IsoDate, to: IsoDate): number {
  return toEpochDay(to) - toEpochDay(from);
}

/**
 * Same day-of-month `months` later, clamped to the end of shorter months:
 * 31 Jan + 1 month = 28/29 Feb. Always measured from the original date, so
 * a 31st stays the 31st in months that have one.
 */
export function addMonthsClamped(date: IsoDate, months: number): IsoDate {
  const [year, month, day] = date.split("-").map(Number);
  const target = new Date(Date.UTC(year, month - 1 + months, 1));
  const lastDay = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
  ).getUTCDate();
  target.setUTCDate(Math.min(day, lastDay));
  return target.toISOString().slice(0, 10);
}

export function maxDate(
  ...dates: (IsoDate | null | undefined)[]
): IsoDate | null {
  return dates.reduce<IsoDate | null>(
    (latest, date) => (date && (!latest || date > latest) ? date : latest),
    null,
  );
}

const kolkataDate = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Kolkata",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Today's date at the gym. */
export function todayAtGym(now: Date = new Date()): IsoDate {
  return kolkataDate.format(now);
}

const displayDate = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

/** "12 Mar 2026". */
export function formatDate(date: IsoDate): string {
  return displayDate.format(new Date(toEpochDay(date) * dayMs));
}

const displayDateTime = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "Asia/Kolkata",
});

/** "12 Mar, 6:05 pm" in gym time. */
export function formatDateTime(moment: Date): string {
  return displayDateTime.format(moment);
}

const displayTime = new Intl.DateTimeFormat("en-IN", {
  hour: "numeric",
  minute: "2-digit",
  timeZone: "Asia/Kolkata",
});

/** "6:05 pm" in gym time. */
export function formatTime(moment: Date): string {
  return displayTime.format(moment);
}

const displayMonth = new Intl.DateTimeFormat("en-IN", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

/** "November 2026" for a "YYYY-MM" month. */
export function formatMonth(month: string): string {
  return displayMonth.format(new Date(`${month}-01T00:00:00Z`));
}
