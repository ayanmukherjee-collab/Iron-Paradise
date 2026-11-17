// A member's own visits as shapes: a calendar grid, weekly bars and a few
// figures for their home screen. Pure functions over gym dates (one visit
// per day at most), so the charts can be tested without a database.
import { addDays, daysBetween, type IsoDate } from "@/lib/dates";

/** Weeks the grid and the bars cover, this week included. */
export const visitWeeks = 13;

/** Monday of the week `date` falls in (weeks run Monday to Sunday). */
export function weekStart(date: IsoDate): IsoDate {
  const sunday0 = new Date(`${date}T00:00:00Z`).getUTCDay();
  return addDays(date, -((sunday0 + 6) % 7));
}

/** The first day the charts need: Monday, `weeks - 1` weeks before this week. */
export function visitWindowStart(today: IsoDate, weeks = visitWeeks): IsoDate {
  return addDays(weekStart(today), -7 * (weeks - 1));
}

export interface GridDay {
  date: IsoDate;
  visited: boolean;
  isToday: boolean;
  /** After today: drawn empty, not as a missed day. */
  future: boolean;
}

/** One column per week, oldest first, Monday at the top. */
export function visitGrid(
  visits: Iterable<IsoDate>,
  today: IsoDate,
  weeks = visitWeeks,
): GridDay[][] {
  const visited = new Set(visits);
  const start = visitWindowStart(today, weeks);
  return Array.from({ length: weeks }, (_, week) =>
    Array.from({ length: 7 }, (_, day) => {
      const date = addDays(start, week * 7 + day);
      return {
        date,
        visited: visited.has(date),
        isToday: date === today,
        future: date > today,
      };
    }),
  );
}

export interface WeekCount {
  /** Monday of the week. */
  start: IsoDate;
  visits: number;
}

/** Visits in each of the last `weeks` weeks, oldest first, this week last. */
export function weeklyVisits(
  visits: Iterable<IsoDate>,
  today: IsoDate,
  weeks = visitWeeks,
): WeekCount[] {
  const start = visitWindowStart(today, weeks);
  const counts: WeekCount[] = Array.from({ length: weeks }, (_, week) => ({
    start: addDays(start, week * 7),
    visits: 0,
  }));
  for (const date of new Set(visits)) {
    if (date < start || date > today) continue;
    counts[Math.floor(daysBetween(start, date) / 7)].visits++;
  }
  return counts;
}

/**
 * Weeks in a row with at least one visit, counting back from this week. A
 * week not over yet doesn't break the run: on Tuesday, a member who trained
 * every week before still has their streak.
 */
export function weekStreak(weeks: WeekCount[]): number {
  let streak = 0;
  for (let i = weeks.length - 1; i >= 0; i--) {
    if (weeks[i].visits > 0) streak++;
    else if (i < weeks.length - 1) break;
  }
  return streak;
}

/** Average visits a week over the weeks already finished. */
export function averagePerWeek(weeks: WeekCount[]): number {
  const finished = weeks.slice(0, -1);
  if (finished.length === 0) return 0;
  const total = finished.reduce((sum, week) => sum + week.visits, 0);
  return Math.round((total / finished.length) * 10) / 10;
}

/** Visits since the first of today's month. */
export function visitsThisMonth(
  visits: Iterable<IsoDate>,
  today: IsoDate,
): number {
  const month = today.slice(0, 7);
  let count = 0;
  for (const date of new Set(visits)) {
    if (date.startsWith(month) && date <= today) count++;
  }
  return count;
}
