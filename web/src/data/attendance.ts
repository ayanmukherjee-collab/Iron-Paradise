// Browser versions of src/attendance/queries.ts and src/bulletin/queries.ts.
import type { Batches } from "@/attendance/batches";
import type {
  CheckInSetup,
  MonthSummary,
  OwnAttendance,
  Visit,
} from "@/attendance/queries";
import { visitWindowStart } from "@/attendance/visit-stats";
import { splitBatches } from "@/bulletin/hours";
import type {
  AnnouncementRow,
  ClosureRow,
  TodayControls,
} from "@/bulletin/queries";
import type { CrowdSettings, TimeRange, WeeklyHours } from "@/bulletin/types";
import { addDays, todayAtGym, type IsoDate } from "@/lib/dates";
import { weekdayKey } from "../actions/bulletin";
import { dataOf } from "./action";
import { date, rpc, table } from "./db";

export type {
  AnnouncementRow,
  CheckInSetup,
  ClosureRow,
  MonthSummary,
  OwnAttendance,
  TodayControls,
  Visit,
};

// Pure helpers, copied from src/attendance/queries.ts (a server module).
export type MonthKey = string;

export function isMonthKey(value: unknown): value is MonthKey {
  return typeof value === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

export function shiftMonthKey(month: MonthKey, by: number): MonthKey {
  const [year, monthNumber] = month.split("-").map(Number);
  const day = new Date(Date.UTC(year, monthNumber - 1 + by, 1));
  return day.toISOString().slice(0, 7);
}

function monthBounds(month: MonthKey): { first: IsoDate; last: IsoDate } {
  const first = `${month}-01`;
  return { first, last: addDays(`${shiftMonthKey(month, 1)}-01`, -1) };
}

export function daysInMonth(month: MonthKey): IsoDate[] {
  const { first, last } = monthBounds(month);
  const days: IsoDate[] = [];
  for (let day = first; day <= last; day = addDays(day, 1)) days.push(day);
  return days;
}

/** Today's two batches, from the opening hours with any closure applied. */
export async function getBatches(): Promise<Batches> {
  const hours = await rpc<TimeRange[] | null>("gym_hours_on", {
    day: todayAtGym(),
  });
  return splitBatches(hours ?? []);
}

/** Everyone who came in on one gym day, latest first. */
export async function listVisitsOn(day: IsoDate): Promise<Visit[]> {
  const rows = dataOf(
    await table("attendance")
      .select(
        "memberId:member_id, checkedInAt:checked_in_at, method, members(member_code, full_name), profiles(full_name)",
      )
      .eq("gym_date", day)
      .order("checked_in_at", { ascending: false })
      .limit(1000),
  ) as {
    memberId: string;
    checkedInAt: string;
    method: Visit["method"];
    members: { member_code: string; full_name: string };
    profiles: { full_name: string } | null;
  }[];
  return rows.map((row) => ({
    memberId: row.memberId,
    memberCode: row.members.member_code,
    fullName: row.members.full_name,
    checkedInAt: date(row.checkedInAt),
    method: row.method,
    // Null for trainers, who cannot read other staff profiles.
    markedBy: row.profiles?.full_name ?? null,
  }));
}

export async function getMonthSummary(month: MonthKey): Promise<MonthSummary> {
  const { first, last } = monthBounds(month);
  const summary = await rpc<{
    perDay: { day: IsoDate; visits: number }[];
    members: number;
  }>("attendance_month", { first_day: first, last_day: last });
  const busiestDay = summary.perDay.reduce<MonthSummary["busiestDay"]>(
    (best, row) => (!best || row.visits > best.visits ? row : best),
    null,
  );
  return {
    totalVisits: summary.perDay.reduce((sum, row) => sum + row.visits, 0),
    members: summary.members,
    busiestDay,
    perDay: summary.perDay,
  };
}

export async function getOwnAttendance(
  memberId: string,
): Promise<OwnAttendance> {
  const today = todayAtGym();
  const rows = dataOf(
    await table("attendance")
      .select("gymDate:gym_date, checkedInAt:checked_in_at, method")
      .eq("member_id", memberId)
      .gte("gym_date", visitWindowStart(today))
      .order("gym_date", { ascending: false }),
  ) as { gymDate: IsoDate; checkedInAt: string; method: "qr" | "manual" }[];
  const visits = rows.map((row) => ({
    ...row,
    checkedInAt: date(row.checkedInAt),
  }));
  return {
    today: visits.find((visit) => visit.gymDate === today)?.checkedInAt ?? null,
    visits,
  };
}

export async function getCheckInSetup(): Promise<CheckInSetup> {
  const [settings, printedCode, displays] = await Promise.all([
    table("gym_settings")
      .select("printed_qr_enabled")
      .maybeSingle()
      .then(dataOf<{ printed_qr_enabled: boolean } | null>),
    rpc<string>("printed_checkin_code"),
    table("desk_displays")
      .select(
        "id, label, createdAt:created_at, lastSeenAt:last_seen_at, profiles(full_name)",
      )
      .is("revoked_at", null)
      .order("created_at")
      .then(
        dataOf<
          {
            id: string;
            label: string;
            createdAt: string;
            lastSeenAt: string | null;
            profiles: { full_name: string } | null;
          }[]
        >,
      ),
  ]);
  return {
    printedQrEnabled: settings?.printed_qr_enabled ?? true,
    printedCode,
    displays: (
      displays as {
        id: string;
        label: string;
        createdAt: string;
        lastSeenAt: string | null;
        profiles: { full_name: string } | null;
      }[]
    ).map((row) => ({
      id: row.id,
      label: row.label,
      createdAt: date(row.createdAt),
      lastSeenAt: date(row.lastSeenAt),
      createdBy: row.profiles?.full_name ?? null,
    })),
  };
}

/** The rotating code for a signed-out desk display. */
export async function getDeskCode(
  token: string,
): Promise<{ code: string; secondsLeft: number }> {
  const rows = await rpc<{ code: string; seconds_left: number }[]>(
    "desk_code",
    { raw_token: token },
  );
  return { code: rows[0].code, secondsLeft: rows[0].seconds_left };
}

// ---- Bulletin (owner and manager screens) -----------------------------------

async function liveAnnouncements(): Promise<AnnouncementRow[]> {
  const rows = dataOf(
    await table("announcements")
      .select(
        "id, title, body, pinned, expiresAt:expires_at, createdAt:created_at",
      )
      .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
      .order("pinned", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(20),
  ) as (Omit<AnnouncementRow, "expiresAt" | "createdAt"> & {
    expiresAt: string | null;
    createdAt: string;
  })[];
  return rows.map((row) => ({
    ...row,
    expiresAt: date(row.expiresAt),
    createdAt: date(row.createdAt),
  }));
}

export async function getTodayControls(): Promise<TodayControls> {
  const today = todayAtGym();
  const [settings, closure, announcements] = await Promise.all([
    table("gym_settings")
      .select("weekly_hours")
      .maybeSingle()
      .then(dataOf<{ weekly_hours: WeeklyHours } | null>),
    table("gym_closures")
      .select("reason, hours")
      .eq("closes_on", today)
      .maybeSingle()
      .then(dataOf<TodayControls["closure"]>),
    liveAnnouncements(),
  ]);
  return {
    today,
    usual: settings?.weekly_hours[weekdayKey(today)] ?? [],
    closure,
    announcements,
  };
}

interface HoursSettingsRow {
  weekly_hours: WeeklyHours;
  crowd_capacity: number;
  crowd_multiplier: number | string;
  crowd_full_minutes: number;
  crowd_gone_minutes: number;
}

/**
 * The week's hours, every closure from today on and the crowd meter's
 * settings, for Settings.
 */
export async function getHoursSettings(): Promise<{
  weekly: WeeklyHours;
  closures: ClosureRow[];
  crowd: CrowdSettings;
}> {
  const today = todayAtGym();
  const [settings, closures] = await Promise.all([
    table("gym_settings")
      .select(
        "weekly_hours, crowd_capacity, crowd_multiplier, crowd_full_minutes, crowd_gone_minutes",
      )
      .maybeSingle()
      .then(dataOf<HoursSettingsRow | null>),
    table("gym_closures")
      .select("id, date:closes_on, reason, hours")
      .gte("closes_on", today)
      .order("closes_on")
      .then(dataOf<ClosureRow[]>),
  ]);
  const row = settings!;
  return {
    weekly: row.weekly_hours,
    closures,
    crowd: {
      comfortableCapacity: row.crowd_capacity,
      calibrationMultiplier: Number(row.crowd_multiplier),
      fullMinutes: row.crowd_full_minutes,
      goneMinutes: row.crowd_gone_minutes,
    },
  };
}
