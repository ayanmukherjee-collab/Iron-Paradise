import { z } from "zod";

// The shape of bulletin.json: everything a member's phone needs to show
// hours, closures, announcements and the crowd meter. Postgres builds it
// (public.publish_bulletin, see supabase/migrations) and the app reads it
// back from the public data Worker, so both sides are checked against this.

/** Day keys in Date#getDay() order: index 0 is Sunday. */
export const DAY_KEYS = [
  "sun",
  "mon",
  "tue",
  "wed",
  "thu",
  "fri",
  "sat",
] as const;
export type DayKey = (typeof DAY_KEYS)[number];

/** Gym-time "HH:MM", 24-hour. */
export const clockTime = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Pick a time");

/**
 * One opening. A close earlier than the open runs past midnight into the
 * next day (18:00–02:00).
 */
export const timeRange = z
  .object({ open: clockTime, close: clockTime })
  .refine((range) => range.open !== range.close, {
    message: "Closing time must differ from opening time",
  });
export type TimeRange = z.infer<typeof timeRange>;

const dayHours = z.array(timeRange).max(4);

/** An empty day means closed all day. */
export const weeklyHours = z.object({
  sun: dayHours,
  mon: dayHours,
  tue: dayHours,
  wed: dayHours,
  thu: dayHours,
  fri: dayHours,
  sat: dayHours,
});
export type WeeklyHours = z.infer<typeof weeklyHours>;

export const closure = z.object({
  date: z.iso.date(),
  reason: z.string().max(80),
  /** null: closed all day. An array: shortened hours that day. */
  hours: z.array(timeRange).max(4).nullable(),
});
export type Closure = z.infer<typeof closure>;

export const announcement = z.object({
  id: z.uuid(),
  title: z.string().max(120),
  body: z.string().max(2000),
  pinned: z.boolean(),
  expiresAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
});
export type Announcement = z.infer<typeof announcement>;

export const crowdSettings = z.object({
  comfortableCapacity: z.number().int().positive(),
  calibrationMultiplier: z.number().positive(),
  /** Minutes a check-in counts as one full person. */
  fullMinutes: z.number().int().positive(),
  /** Minutes after which a check-in no longer counts at all. */
  goneMinutes: z.number().int().positive(),
});
export type CrowdSettings = z.infer<typeof crowdSettings>;

export const bulletin = z.object({
  version: z.number().int().nonnegative(),
  updatedAt: z.iso.datetime(),
  timezone: z.literal("Asia/Kolkata"),
  hours: weeklyHours,
  closures: z.array(closure),
  announcements: z.array(announcement).max(20),
  crowd: crowdSettings,
});
export type Bulletin = z.infer<typeof bulletin>;
