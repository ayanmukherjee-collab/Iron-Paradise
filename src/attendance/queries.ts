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
import type { Viewer } from "@/auth/session";
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

/** The training batch hours. Staff can read them; members cannot. */
export async function getBatches(viewer: Viewer): Promise<Batches> {
  try {
    const [row] = await withUserContext(getDb(), viewer.userId, (tx) =>
      tx
        .select({
          morningOpens: gymSettings.morningOpens,
          morningCloses: gymSettings.morningCloses,
          eveningOpens: gymSettings.eveningOpens,
          eveningCloses: gymSettings.eveningCloses,
        })
        .from(gymSettings),
    );
    return row ?? defaultBatches;
  } catch (error) {
    // Until the check_in_batches migration reaches the database the columns
    // don't exist (Postgres 42703). Show the defaults rather than break the
    // page; anything else is a real failure.
    if (pgCode(error) === "42703") return defaultBatches;
    throw error;
  }
}

/** The migration's defaults. */
const defaultBatches: Batches = {
  morningOpens: "05:00:00",
  morningCloses: "11:00:00",
  eveningOpens: "16:00:00",
  eveningCloses: "22:00:00",
};

function pgCode(error: unknown): string | undefined {
  const cause = (error as { cause?: { code?: string } })?.cause;
  return cause?.code ?? (error as { code?: string })?.code;
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

export interface OwnAttendance {
  today: Date | null;
  thisMonth: number;
  recent: { gymDate: IsoDate; checkedInAt: Date; method: "qr" | "manual" }[];
}

/** The member's own visits, for their home screen. */
export async function getOwnAttendance(
  viewer: Viewer,
  memberId: string,
): Promise<OwnAttendance> {
  const today = todayAtGym();
  const { first } = monthBounds(today.slice(0, 7));
  return withUserContext(getDb(), viewer.userId, async (tx) => {
    const [recent, [month]] = await Promise.all([
      tx
        .select({
          gymDate: attendance.gymDate,
          checkedInAt: attendance.checkedInAt,
          method: attendance.method,
        })
        .from(attendance)
        .where(eq(attendance.memberId, memberId))
        .orderBy(desc(attendance.gymDate))
        .limit(30),
      tx
        .select({ visits: count() })
        .from(attendance)
        .where(
          and(
            eq(attendance.memberId, memberId),
            gte(attendance.gymDate, first),
          ),
        ),
    ]);
    return {
      today:
        recent.find((visit) => visit.gymDate === today)?.checkedInAt ?? null,
      thisMonth: month?.visits ?? 0,
      recent,
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
