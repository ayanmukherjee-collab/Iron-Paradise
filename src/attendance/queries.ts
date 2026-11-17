import "server-only";
import {
  and,
  asc,
  count,
  countDistinct,
  desc,
  eq,
  gte,
  lte,
  sql,
} from "drizzle-orm";
import type { Batches } from "@/attendance/batches";
import { visitWindowStart } from "@/attendance/visit-stats";
import { splitBatches } from "@/bulletin/hours";
import type { TimeRange } from "@/bulletin/types";
import type { Viewer } from "@/auth/viewer";
import { getDb } from "@/db/client";
import {
  attendance,
  deskDisplays,
  gymSettings,
  members,
  profiles,
} from "@/db/schema";
import { rowsOf, withUserContext } from "@/db/user-context";
import { addDays, todayAtGym, type IsoDate } from "@/lib/dates";

/**
 * Today's two batches, from the opening hours with any closure applied.
 * One small query: gym_hours_on works the day out in Postgres.
 */
export async function getBatches(viewer: Viewer): Promise<Batches> {
  const result = await withUserContext(getDb(), viewer.userId, (tx) =>
    tx.execute(sql`select public.gym_hours_on(${todayAtGym()}) as hours`),
  );
  const [row] = rowsOf<{ hours: TimeRange[] | string }>(result);
  // postgres-js hands jsonb back parsed; PGlite in tests may not.
  const hours =
    typeof row?.hours === "string" ? JSON.parse(row.hours) : row?.hours;
  return splitBatches(hours ?? []);
}

export interface Visit {
  memberId: string;
  memberCode: string;
  fullName: string;
  checkedInAt: Date;
  method: "qr" | "manual";
  markedBy: string | null;
}

/** Everyone who came in on one gym day, latest first. */
export async function listVisitsOn(
  viewer: Viewer,
  day: IsoDate,
): Promise<Visit[]> {
  return withUserContext(getDb(), viewer.userId, (tx) =>
    tx
      .select({
        memberId: attendance.memberId,
        memberCode: members.memberCode,
        fullName: members.fullName,
        checkedInAt: attendance.checkedInAt,
        method: attendance.method,
        // Null for trainers, who cannot read other staff profiles.
        markedBy: profiles.fullName,
      })
      .from(attendance)
      .innerJoin(members, eq(members.id, attendance.memberId))
      .leftJoin(profiles, eq(profiles.id, attendance.markedBy))
      .where(eq(attendance.gymDate, day))
      .orderBy(desc(attendance.checkedInAt)),
  );
}

export type MonthKey = string;

export function isMonthKey(value: unknown): value is MonthKey {
  return typeof value === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

export function shiftMonthKey(month: MonthKey, by: number): MonthKey {
  const [year, monthNumber] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year, monthNumber - 1 + by, 1));
  return date.toISOString().slice(0, 7);
}

function monthBounds(month: MonthKey): { first: IsoDate; last: IsoDate } {
  const first = `${month}-01`;
  return { first, last: addDays(`${shiftMonthKey(month, 1)}-01`, -1) };
}

export interface MonthSummary {
  totalVisits: number;
  /** How many different members came at least once. */
  members: number;
  busiestDay: { day: IsoDate; visits: number } | null;
  /** Visits on each day of the month that had any, oldest first. */
  perDay: { day: IsoDate; visits: number }[];
}

/** Simple monthly counts (brief §4.3): totals, busiest day, visits per day. */
export async function getMonthSummary(
  viewer: Viewer,
  month: MonthKey,
): Promise<MonthSummary> {
  const { first, last } = monthBounds(month);
  const inMonth = and(
    gte(attendance.gymDate, first),
    lte(attendance.gymDate, last),
  );

  return withUserContext(getDb(), viewer.userId, async (tx) => {
    const [perDay, [distinct]] = await Promise.all([
      tx
        .select({ day: attendance.gymDate, visits: count() })
        .from(attendance)
        .where(inMonth)
        .groupBy(attendance.gymDate)
        .orderBy(asc(attendance.gymDate)),
      tx
        .select({ members: countDistinct(attendance.memberId) })
        .from(attendance)
        .where(inMonth),
    ]);
    const busiestDay = perDay.reduce<MonthSummary["busiestDay"]>(
      (best, row) => (!best || row.visits > best.visits ? row : best),
      null,
    );
    return {
      totalVisits: perDay.reduce((sum, row) => sum + row.visits, 0),
      members: distinct?.members ?? 0,
      busiestDay,
      perDay,
    };
  });
}

/** Days in a month, for charts that need a slot per day. */
export function daysInMonth(month: MonthKey): IsoDate[] {
  const { first, last } = monthBounds(month);
  const days: IsoDate[] = [];
  for (let day = first; day <= last; day = addDays(day, 1)) days.push(day);
  return days;
}

export interface OwnVisit {
  gymDate: IsoDate;
  checkedInAt: Date;
  method: "qr" | "manual";
}

export interface OwnAttendance {
  today: Date | null;
  /** Every visit since visitWindowStart, newest first: what the charts draw. */
  visits: OwnVisit[];
}

/**
 * The member's own visits for their home screen: one small query over the
 * weeks the charts cover (at most one row a day), and the figures are worked
 * out from the same rows.
 */
export async function getOwnAttendance(
  viewer: Viewer,
  memberId: string,
): Promise<OwnAttendance> {
  const today = todayAtGym();
  return withUserContext(getDb(), viewer.userId, async (tx) => {
    const visits = await tx
      .select({
        gymDate: attendance.gymDate,
        checkedInAt: attendance.checkedInAt,
        method: attendance.method,
      })
      .from(attendance)
      .where(
        and(
          eq(attendance.memberId, memberId),
          gte(attendance.gymDate, visitWindowStart(today)),
        ),
      )
      .orderBy(desc(attendance.gymDate));
    return {
      today:
        visits.find((visit) => visit.gymDate === today)?.checkedInAt ?? null,
      visits,
    };
  });
}

export interface DeskDisplay {
  id: string;
  label: string;
  createdAt: Date;
  lastSeenAt: Date | null;
  createdBy: string | null;
}

export interface CheckInSetup {
  printedQrEnabled: boolean;
  printedCode: string;
  displays: DeskDisplay[];
}

/** What the check-in setup page shows the owner or a manager. */
export async function getCheckInSetup(viewer: Viewer): Promise<CheckInSetup> {
  return withUserContext(getDb(), viewer.userId, async (tx) => {
    const [[settings], printed, displays] = await Promise.all([
      tx
        .select({ printedQrEnabled: gymSettings.printedQrEnabled })
        .from(gymSettings),
      tx.execute(sql`select public.printed_checkin_code() as code`),
      tx
        .select({
          id: deskDisplays.id,
          label: deskDisplays.label,
          createdAt: deskDisplays.createdAt,
          lastSeenAt: deskDisplays.lastSeenAt,
          createdBy: profiles.fullName,
        })
        .from(deskDisplays)
        .leftJoin(profiles, eq(profiles.id, deskDisplays.createdBy))
        .where(sql`${deskDisplays.revokedAt} is null`)
        .orderBy(asc(deskDisplays.createdAt)),
    ]);
    return {
      printedQrEnabled: settings?.printedQrEnabled ?? true,
      printedCode: rowsOf<{ code: string }>(printed)[0].code,
      displays,
    };
  });
}

/**
 * The rotating code for a desk display. The device is signed out, so there
 * is no user to run as: this calls the one `private` function that checks
 * the desk token itself (see the check-in migration).
 */
export async function getDeskCode(
  token: string,
): Promise<{ code: string; secondsLeft: number }> {
  const result = await getDb().execute(
    sql`select code, seconds_left from private.desk_checkin_code(${token})`,
  );
  const [row] = rowsOf<{ code: string; seconds_left: number }>(result);
  return { code: row.code, secondsLeft: row.seconds_left };
}
