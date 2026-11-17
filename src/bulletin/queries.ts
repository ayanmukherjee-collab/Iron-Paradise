import "server-only";
import { asc, desc, eq, gt, gte, isNull, or } from "drizzle-orm";
import type { Viewer } from "@/auth/session";
import { getDb } from "@/db/client";
import { announcements, gymClosures, gymSettings } from "@/db/schema";
import { withUserContext, type UserTransaction } from "@/db/user-context";
import { todayAtGym, type IsoDate } from "@/lib/dates";
import {
  DAY_KEYS,
  type Closure,
  type TimeRange,
  type WeeklyHours,
} from "@/bulletin/types";

export function weekdayKey(date: IsoDate) {
  return DAY_KEYS[new Date(`${date}T00:00:00Z`).getUTCDay()];
}

export interface AnnouncementRow {
  id: string;
  title: string;
  body: string;
  pinned: boolean;
  expiresAt: Date | null;
  createdAt: Date;
}

export interface TodayControls {
  today: IsoDate;
  /** The usual openings for today's weekday, before any closure. */
  usual: TimeRange[];
  closure: Pick<Closure, "reason" | "hours"> | null;
  announcements: AnnouncementRow[];
}

/**
 * What the owner's and managers' Home panel shows: today's hours and any
 * closure, and the live announcements. One transaction, three small reads.
 */
export async function getTodayControls(viewer: Viewer): Promise<TodayControls> {
  const today = todayAtGym();
  return withUserContext(getDb(), viewer.userId, async (tx) => {
    const [[settings], [closure], live] = await Promise.all([
      tx.select({ hours: gymSettings.weeklyHours }).from(gymSettings),
      tx
        .select({ reason: gymClosures.reason, hours: gymClosures.hours })
        .from(gymClosures)
        .where(eq(gymClosures.closesOn, today)),
      liveAnnouncements(tx),
    ]);
    return {
      today,
      usual: settings?.hours[weekdayKey(today)] ?? [],
      closure: closure ?? null,
      announcements: live,
    };
  });
}

function liveAnnouncements(tx: UserTransaction) {
  return tx
    .select({
      id: announcements.id,
      title: announcements.title,
      body: announcements.body,
      pinned: announcements.pinned,
      expiresAt: announcements.expiresAt,
      createdAt: announcements.createdAt,
    })
    .from(announcements)
    .where(
      or(
        isNull(announcements.expiresAt),
        gt(announcements.expiresAt, new Date()),
      ),
    )
    .orderBy(desc(announcements.pinned), desc(announcements.createdAt))
    .limit(20);
}

export interface ClosureRow extends Closure {
  id: string;
}

/** The week's hours and every closure from today on, for Settings. */
export async function getHoursSettings(
  viewer: Viewer,
): Promise<{ weekly: WeeklyHours; closures: ClosureRow[] }> {
  const today = todayAtGym();
  return withUserContext(getDb(), viewer.userId, async (tx) => {
    const [[settings], closures] = await Promise.all([
      tx.select({ hours: gymSettings.weeklyHours }).from(gymSettings),
      tx
        .select({
          id: gymClosures.id,
          date: gymClosures.closesOn,
          reason: gymClosures.reason,
          hours: gymClosures.hours,
        })
        .from(gymClosures)
        .where(gte(gymClosures.closesOn, today))
        .orderBy(asc(gymClosures.closesOn)),
    ]);
    return { weekly: settings.hours, closures };
  });
}
