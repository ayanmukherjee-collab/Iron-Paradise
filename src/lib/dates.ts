// Calendar dates are plain "YYYY-MM-DD" strings in the gym's local calendar
// (Asia/Kolkata). They carry no time or zone, so they cannot drift a day
// when the server runs in UTC.

export type IsoDate = string;

const isoPattern = /^(\d{4})-(\d{2})-(\d{2})$/;
const dayMs = 86_400_000;

// Ledgers and due dates do this date arithmetic thousands of times per page
// (every member, every month since they joined), and building a Date and
// calling toISOString each time cost most of the Worker's 10 ms CPU
// allowance. Real calendar dates in years 1000–9999 take the plain integer
// path below, several times faster; anything else (malformed, overflowing,
// odd years) takes the original Date path, so every result is unchanged.
const firstFastYear = 1000;
const lastFastYear = 9999;
const monthLengths = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function daysInMonth(year: number, month: number): number {
  return month === 2 && isLeapYear(year) ? 29 : monthLengths[month - 1];
}

function isFastDate(year: number, month: number, day: number): boolean {
  return (
    year >= firstFastYear &&
    year <= lastFastYear &&
    month >= 1 &&
    month <= 12 &&
    day >= 1 &&
    day <= daysInMonth(year, month)
  );
}

/** Days since 1970-01-01 (proleptic Gregorian; H. Hinnant's algorithm). */
function civilToEpochDay(year: number, month: number, day: number): number {
  const y = month <= 2 ? year - 1 : year;
  const era = Math.floor(y / 400);
  const yearOfEra = y - era * 400;
  const dayOfYear =
    Math.floor((153 * (month > 2 ? month - 3 : month + 9) + 2) / 5) + day - 1;
  const dayOfEra =
    yearOfEra * 365 +
    Math.floor(yearOfEra / 4) -
    Math.floor(yearOfEra / 100) +
    dayOfYear;
  return era * 146097 + dayOfEra - 719468;
}

function formatIso(year: number, month: number, day: number): IsoDate {
  return `${year}-${month < 10 ? "0" : ""}${month}-${day < 10 ? "0" : ""}${day}`;
}

const firstFastDay = civilToEpochDay(firstFastYear, 1, 1);
const lastFastDay = civilToEpochDay(lastFastYear, 12, 31);

function toEpochDay(date: IsoDate): number {
  const match = isoPattern.exec(date);
  if (!match) throw new RangeError(`Not a YYYY-MM-DD date: ${date}`);
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (isFastDate(year, month, day)) return civilToEpochDay(year, month, day);
  return Date.UTC(year, month - 1, day) / dayMs;
}

function fromEpochDay(day: number): IsoDate {
  if (Number.isInteger(day) && day >= firstFastDay && day <= lastFastDay) {
    // The inverse of civilToEpochDay.
    const shifted = day + 719468;
    const era = Math.floor(shifted / 146097);
    const dayOfEra = shifted - era * 146097;
    const yearOfEra = Math.floor(
      (dayOfEra -
        Math.floor(dayOfEra / 1460) +
        Math.floor(dayOfEra / 36524) -
        Math.floor(dayOfEra / 146096)) /
        365,
    );
    const dayOfYear =
      dayOfEra -
      (365 * yearOfEra +
        Math.floor(yearOfEra / 4) -
        Math.floor(yearOfEra / 100));
    const monthIndex = Math.floor((5 * dayOfYear + 2) / 153);
    const dayOfMonth = dayOfYear - Math.floor((153 * monthIndex + 2) / 5) + 1;
    const month = monthIndex < 10 ? monthIndex + 3 : monthIndex - 9;
    const year = yearOfEra + era * 400 + (month <= 2 ? 1 : 0);
    return formatIso(year, month, dayOfMonth);
  }
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
  return monthsAfter(date)(months);
}

/**
 * addMonthsClamped(date, months) for many values of `months`, reading `date`
 * once: a membership's due dates are its start date 0, 1, 2, … months on.
 */
export function monthsAfter(date: IsoDate): (months: number) => IsoDate {
  if (isoPattern.test(date)) {
    const year = Number(date.slice(0, 4));
    const month = Number(date.slice(5, 7));
    const day = Number(date.slice(8, 10));
    if (year >= firstFastYear && month >= 1 && month <= 12 && day >= 1) {
      const startMonth = year * 12 + month - 1;
      return (months) => {
        const monthsSinceYearZero = startMonth + months;
        const targetYear = Math.floor(monthsSinceYearZero / 12);
        if (
          !Number.isInteger(months) ||
          targetYear < firstFastYear ||
          targetYear > lastFastYear
        )
          return addMonthsSlowly(date, months);
        const targetMonth = monthsSinceYearZero - targetYear * 12 + 1;
        const lastDay = daysInMonth(targetYear, targetMonth);
        return formatIso(targetYear, targetMonth, Math.min(day, lastDay));
      };
    }
  }
  return (months) => addMonthsSlowly(date, months);
}

/** The original Date-based addMonthsClamped, for dates off the fast path. */
function addMonthsSlowly(date: IsoDate, months: number): IsoDate {
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

const displayDayMonth = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

/** "12 Mar" this year, "12 Mar 25" in any other year: for tight columns. */
export function formatShortDate(date: IsoDate, today: IsoDate): string {
  const dayMonth = displayDayMonth.format(new Date(toEpochDay(date) * dayMs));
  return date.slice(0, 4) === today.slice(0, 4)
    ? dayMonth
    : `${dayMonth} ${date.slice(2, 4)}`;
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
