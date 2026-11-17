// Browser versions of src/bulletin/actions.ts. Members now read the bulletin
// straight from the database (public.bulletin), so a save is just the write:
// nothing to rebuild or publish to KV afterwards.
import { z } from "zod";
import {
  closedBatches,
  closureFor,
  splitBatches,
  toMinutes,
  type Batch,
} from "@/bulletin/hours";
import {
  clockTime,
  DAY_KEYS,
  type TimeRange,
  type WeeklyHours,
} from "@/bulletin/types";
import { todayAtGym, type IsoDate } from "@/lib/dates";
import { checkbox, isoDate } from "@/members/schemas";
import { dataOf, Refusal } from "../data/action";
import { table } from "../data/db";
import { guardedAction } from "../data/guarded";

export function weekdayKey(date: IsoDate) {
  return DAY_KEYS[new Date(`${date}T00:00:00Z`).getUTCDay()];
}

/** Kept for the Settings button; there is nothing left to publish. */
export const publishBulletinNow = guardedAction({
  permission: "bulletin.publish",
  input: z.object({}),
  run: async () => ({
    message: "Up to date. Members see changes as soon as they're saved.",
  }),
});

// ---- Closures ------------------------------------------------------------

const part = z.enum(["day", "morning", "evening"]);

async function weeklyHours(): Promise<WeeklyHours> {
  const row = dataOf(
    await table("gym_settings").select("weekly_hours").maybeSingle(),
  ) as { weekly_hours: WeeklyHours } | null;
  if (!row) throw new Refusal("The gym's settings are missing.");
  return row.weekly_hours;
}

/** The usual openings on a date and the closure saved for it, if any. */
async function dayState(date: IsoDate) {
  const [hours, closure] = await Promise.all([
    weeklyHours(),
    table("gym_closures")
      .select("reason, hours")
      .eq("closes_on", date)
      .maybeSingle()
      .then(dataOf<{ reason: string; hours: TimeRange[] } | null>),
  ]);
  const usual: TimeRange[] = hours[weekdayKey(date)] ?? [];
  return { usual, closure };
}

/** Saves the closure that shuts `shut`, or removes it when nothing is shut. */
async function writeClosure(
  userId: string,
  date: IsoDate,
  usual: TimeRange[],
  shut: Record<Batch, boolean>,
  reason: string,
) {
  const closure = closureFor(usual, shut);
  if (closure === "open") {
    dataOf(await table("gym_closures").delete().eq("closes_on", date));
    return;
  }
  const existing = dataOf(
    await table("gym_closures")
      .select("id")
      .eq("closes_on", date)
      .maybeSingle(),
  ) as { id: string } | null;
  dataOf(
    existing
      ? await table("gym_closures")
          .update({ reason, hours: closure.hours })
          .eq("id", existing.id)
      : await table("gym_closures").insert({
          closes_on: date,
          reason,
          hours: closure.hours,
          created_by: userId,
        }),
  );
}

export const toggleClosedToday = guardedAction({
  permission: "bulletin.publish",
  input: z.object({ part }),
  run: async ({ part }, viewer) => {
    const today = todayAtGym();
    const { usual, closure } = await dayState(today);
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
      viewer.userId,
      today,
      usual,
      next,
      closure?.reason ?? "",
    );
  },
});

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
    if (date < todayAtGym()) throw new Refusal("Pick today or a later day.");
    const { usual } = await dayState(date);
    const shut = { morning: part !== "evening", evening: part !== "morning" };
    if (closureFor(usual, shut) === "open") {
      throw new Refusal(
        usual.length
          ? `There's no ${part} batch that day.`
          : "The gym doesn't open that day anyway.",
      );
    }
    await writeClosure(viewer.userId, date, usual, shut, reason);
    return { message: "Saved. Members see it straight away." };
  },
});

export const deleteClosure = guardedAction({
  permission: "bulletin.publish",
  input: z.object({ closureId: z.uuid() }),
  run: async ({ closureId }) => {
    dataOf(await table("gym_closures").delete().eq("id", closureId));
  },
});

// ---- Weekly hours ----------------------------------------------------------

const optionalClock = z.union([z.literal(""), clockTime]).optional();

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
  run: async ({ day, openings }) => {
    // One row, read then written whole; only the owner edits hours.
    const hours = await weeklyHours();
    dataOf(
      await table("gym_settings")
        .update({ weekly_hours: { ...hours, [day]: openings } })
        .eq("id", true),
    );
    return { message: "Saved. Check-ins follow these hours." };
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
  expiresOn: z
    .union([z.literal(""), isoDate])
    .optional()
    .transform((value) => value || null),
};

/** The end of a gym day, as a moment. */
function endOfGymDay(date: IsoDate): string {
  return new Date(`${date}T23:59:59+05:30`).toISOString();
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
    const expires_at = expiresOn ? endOfGymDay(expiresOn) : null;
    dataOf(
      announcementId
        ? await table("announcements")
            .update({ title, body, pinned, expires_at })
            .eq("id", announcementId)
        : await table("announcements").insert({
            title,
            body,
            pinned,
            expires_at,
            created_by: viewer.userId,
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
  run: async ({ announcementId, pinned }) => {
    dataOf(
      await table("announcements").update({ pinned }).eq("id", announcementId),
    );
  },
});

export const deleteAnnouncement = guardedAction({
  permission: "bulletin.publish",
  input: z.object({ announcementId: z.uuid() }),
  run: async ({ announcementId }) => {
    dataOf(await table("announcements").delete().eq("id", announcementId));
  },
});
