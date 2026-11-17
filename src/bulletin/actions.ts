"use server";

// Every export here is a public HTTP endpoint. Export only guardedAction
// results; helpers live in rebuild.ts, publish.ts and hours.ts.
//
// Each save goes through saveAndPublishBulletin: the change and a fresh
// bulletin.json are made in one transaction, and the file reaches members'
// phones after the response is sent.
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { guardedAction } from "@/auth/guarded-action";
import { getDb } from "@/db/client";
import { announcements, gymClosures, gymSettings } from "@/db/schema";
import { withUserContext, type UserTransaction } from "@/db/user-context";
import { todayAtGym, type IsoDate } from "@/lib/dates";
import { checkbox, isoDate } from "@/members/schemas";
import { publishNow } from "@/bulletin/publish";
import { rebuildBulletin, saveAndPublishBulletin } from "@/bulletin/rebuild";
import {
  closedBatches,
  closureFor,
  splitBatches,
  toMinutes,
  type Batch,
} from "@/bulletin/hours";
import { weekdayKey } from "@/bulletin/queries";
import { clockTime, DAY_KEYS, type TimeRange } from "@/bulletin/types";

/** A refusal written for the person, like our SQL raises. */
class Refusal extends Error {
  code = "P0001";
}

/**
 * Rebuilds bulletin.json from what's saved and publishes it straight away.
 * Saves already do this on their own; this puts things right if a publish
 * after a save ever failed. It waits for the write so the owner sees whether
 * it worked. Each press is one of the free plan's 1,000 daily KV writes.
 */
export const publishBulletinNow = guardedAction({
  permission: "bulletin.publish",
  input: z.object({}),
  run: async (_input, viewer) => {
    const body = await withUserContext(getDb(), viewer.userId, rebuildBulletin);
    if (!(await publishNow("bulletin.json", body))) {
      throw new Refusal(
        "Couldn't reach the members' data store. This works only on the live site.",
      );
    }
    const { version } = JSON.parse(body) as { version: number };
    return { message: `Published version ${version}.` };
  },
});

// ---- Closures ------------------------------------------------------------

const part = z.enum(["day", "morning", "evening"]);

/** The usual openings on a date and the closure saved for it, if any. */
async function dayState(tx: UserTransaction, date: IsoDate) {
  const [[settings], [closure]] = await Promise.all([
    tx.select({ hours: gymSettings.weeklyHours }).from(gymSettings),
    tx
      .select({ reason: gymClosures.reason, hours: gymClosures.hours })
      .from(gymClosures)
      .where(eq(gymClosures.closesOn, date)),
  ]);
  const usual: TimeRange[] = settings?.hours[weekdayKey(date)] ?? [];
  return { usual, closure: closure ?? null };
}

/** Saves the closure that shuts `shut`, or removes it when nothing is shut. */
async function writeClosure(
  tx: UserTransaction,
  userId: string,
  date: IsoDate,
  usual: TimeRange[],
  shut: Record<Batch, boolean>,
  reason: string,
) {
  const closure = closureFor(usual, shut);
  if (closure === "open") {
    await tx.delete(gymClosures).where(eq(gymClosures.closesOn, date));
    return;
  }
  await tx
    .insert(gymClosures)
    .values({ closesOn: date, reason, hours: closure.hours, createdBy: userId })
    .onConflictDoUpdate({
      target: gymClosures.closesOn,
      set: { reason, hours: closure.hours },
    });
}

/**
 * Home's three tiles: shut (or reopen) today's morning batch, evening batch
 * or the whole day. Tapping a shut tile opens it again.
 */
export const toggleClosedToday = guardedAction({
  permission: "bulletin.publish",
  input: z.object({ part }),
  run: async ({ part }, viewer) => {
    const today = todayAtGym();
    await saveAndPublishBulletin(viewer, async (tx) => {
      const { usual, closure } = await dayState(tx, today);
      if (!usual.length) throw new Refusal("The gym doesn't open today.");
      const shut = closedBatches(usual, closure);
      const has = splitBatches(usual);
      const allShut =
        (!has.morning || shut.morning) && (!has.evening || shut.evening);
      const next =
        part === "day"
          ? { morning: !allShut, evening: !allShut }
          : { ...shut, [part]: !shut[part] };
      await writeClosure(
        tx,
        viewer.userId,
        today,
        usual,
        next,
        closure?.reason ?? "",
      );
    });
  },
});

/** A closure on any day from today on, from Settings, with a reason. */
export const saveClosure = guardedAction({
  permission: "bulletin.publish",
  input: z.object({
    date: isoDate,
    part,
    reason: z
      .string()
      .trim()
      .max(80, "Keep the reason under 80 characters")
      .default(""),
  }),
  run: async ({ date, part, reason }, viewer) => {
    if (date < todayAtGym()) {
      throw new Refusal("Pick today or a later day.");
    }
    await saveAndPublishBulletin(viewer, async (tx) => {
      const { usual } = await dayState(tx, date);
      const shut = {
        morning: part !== "evening",
        evening: part !== "morning",
      };
      if (closureFor(usual, shut) === "open") {
        throw new Refusal(
          usual.length
            ? `There's no ${part} batch that day.`
            : "The gym doesn't open that day anyway.",
        );
      }
      await writeClosure(tx, viewer.userId, date, usual, shut, reason);
    });
    return { message: "Saved. Members see it within a couple of minutes." };
  },
});

export const deleteClosure = guardedAction({
  permission: "bulletin.publish",
  input: z.object({ closureId: z.uuid() }),
  run: async ({ closureId }, viewer) => {
    await saveAndPublishBulletin(viewer, (tx) =>
      tx.delete(gymClosures).where(eq(gymClosures.id, closureId)),
    );
  },
});

// ---- Weekly hours ----------------------------------------------------------

const optionalClock = z.union([z.literal(""), clockTime]).optional();

/**
 * One weekday's batches. The morning batch starts before noon and ends the
 * same day; the evening batch starts at noon or later and may run past
 * midnight. Owner only, like the rest of the check-in settings.
 */
export const saveDayHours = guardedAction({
  permission: "checkin.settings",
  input: z
    .object({
      day: z.enum(DAY_KEYS),
      morningOn: checkbox,
      morningOpen: optionalClock,
      morningClose: optionalClock,
      eveningOn: checkbox,
      eveningOpen: optionalClock,
      eveningClose: optionalClock,
    })
    .transform((input, ctx) => {
      const openings: TimeRange[] = [];
      const fail = (message: string) => {
        ctx.addIssue({ code: "custom", message });
        return z.NEVER;
      };
      if (input.morningOn) {
        const { morningOpen: open, morningClose: close } = input;
        if (!open || !close) return fail("Set both morning times");
        if (toMinutes(open) >= 720)
          return fail("The morning batch must start before noon");
        if (toMinutes(close) <= toMinutes(open))
          return fail("The morning batch must end after it starts");
        openings.push({ open, close });
      }
      if (input.eveningOn) {
        const { eveningOpen: open, eveningClose: close } = input;
        if (!open || !close) return fail("Set both evening times");
        if (toMinutes(open) < 720)
          return fail("The evening batch must start at noon or later");
        if (open === close)
          return fail("The evening batch must end at a different time");
        if (openings[0] && toMinutes(openings[0].close) > toMinutes(open))
          return fail("The morning batch must end before the evening starts");
        openings.push({ open, close });
      }
      return { day: input.day, openings };
    }),
  run: async ({ day, openings }, viewer) => {
    await saveAndPublishBulletin(viewer, (tx) =>
      tx.execute(
        sql`update public.gym_settings set weekly_hours = jsonb_set(weekly_hours, ${`{${day}}`}::text[], ${JSON.stringify(openings)}::jsonb)`,
      ),
    );
    return { message: "Saved. Check-ins follow these hours." };
  },
});

// ---- Crowd meter -----------------------------------------------------------

const wholeNumber = (min: number, max: number, what: string) =>
  z.coerce
    .number()
    .int(`${what} must be a whole number`)
    .min(min, `${what} must be at least ${min}`)
    .max(max, `${what} must be at most ${max}`);

/**
 * How phones turn check-ins into Quiet / Moderate / Busy. Owner only, like
 * the other check-in settings. Limits match gym_settings' checks.
 */
export const saveCrowdSettings = guardedAction({
  permission: "checkin.settings",
  input: z
    .object({
      capacity: wholeNumber(1, 1000, "Capacity"),
      multiplier: z.coerce
        .number()
        .min(0.5, "The multiplier must be at least 0.5")
        .max(5, "The multiplier must be at most 5"),
      fullMinutes: wholeNumber(5, 235, "Full"),
      goneMinutes: wholeNumber(10, 240, "Gone"),
    })
    .refine((input) => input.goneMinutes >= input.fullMinutes + 5, {
      message: "Gone must be at least 5 minutes after Full",
    }),
  run: async ({ capacity, multiplier, fullMinutes, goneMinutes }, viewer) => {
    await saveAndPublishBulletin(viewer, (tx) =>
      tx.update(gymSettings).set({
        crowdCapacity: capacity,
        crowdMultiplier: multiplier.toFixed(2),
        crowdFullMinutes: fullMinutes,
        crowdGoneMinutes: goneMinutes,
      }),
    );
    return { message: "Saved." };
  },
});

// ---- Announcements ---------------------------------------------------------

const announcementFields = {
  title: z
    .string()
    .trim()
    .min(1, "Give the notice a heading")
    .max(120, "Keep the heading under 120 characters"),
  body: z
    .string()
    .trim()
    .max(2000, "Keep the notice under 2,000 characters")
    .default(""),
  pinned: checkbox,
  /** Last gym day it shows; empty for no end. */
  expiresOn: z
    .union([z.literal(""), isoDate])
    .optional()
    .transform((value) => value || null),
};

/** The end of a gym day, as a moment. */
function endOfGymDay(date: IsoDate): Date {
  return new Date(`${date}T23:59:59+05:30`);
}

export const saveAnnouncement = guardedAction({
  permission: "bulletin.publish",
  input: z.object({
    announcementId: z.union([z.literal(""), z.uuid()]).optional(),
    ...announcementFields,
  }),
  run: async ({ announcementId, title, body, pinned, expiresOn }, viewer) => {
    if (expiresOn && expiresOn < todayAtGym()) {
      throw new Refusal("The last day can't be in the past.");
    }
    const expiresAt = expiresOn ? endOfGymDay(expiresOn) : null;
    await saveAndPublishBulletin(viewer, (tx) =>
      announcementId
        ? tx
            .update(announcements)
            .set({ title, body, pinned, expiresAt })
            .where(eq(announcements.id, announcementId))
        : tx.insert(announcements).values({
            title,
            body,
            pinned,
            expiresAt,
            createdBy: viewer.userId,
          }),
    );
  },
});

export const pinAnnouncement = guardedAction({
  permission: "bulletin.publish",
  input: z.object({
    announcementId: z.uuid(),
    pinned: z.enum(["true", "false"]).transform((value) => value === "true"),
  }),
  run: async ({ announcementId, pinned }, viewer) => {
    await saveAndPublishBulletin(viewer, (tx) =>
      tx
        .update(announcements)
        .set({ pinned })
        .where(eq(announcements.id, announcementId)),
    );
  },
});

export const deleteAnnouncement = guardedAction({
  permission: "bulletin.publish",
  input: z.object({ announcementId: z.uuid() }),
  run: async ({ announcementId }, viewer) => {
    await saveAndPublishBulletin(viewer, (tx) =>
      tx.delete(announcements).where(eq(announcements.id, announcementId)),
    );
  },
});
