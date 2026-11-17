"use server";

// Every export here is a public HTTP endpoint. Export only guardedAction
// results; helpers live in queries.ts and code.ts.
import { randomBytes } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { isCheckInCode } from "@/attendance/code";
import { guardedAction } from "@/auth/guarded-action";
import { getDb } from "@/db/client";
import { attendance, gymSettings, members } from "@/db/schema";
import { rowsOf, withUserContext } from "@/db/user-context";
import { publicEnv } from "@/lib/env";
import { takeRateLimit } from "@/lib/rate-limit";
import { getOwnMembership } from "@/members/queries";
import { getMemberPayments } from "@/payments/queries";

/** A refusal with a message written for the person, like our SQL raises. */
class Refusal extends Error {
  code = "P0001";
}

export interface CheckInResult {
  status: "checked_in" | "already";
  firstName: string;
  /** What they owe right now; they are let in either way (owner, 2026-11-15). */
  owedPaise: number;
}

export const checkIn = guardedAction({
  permission: "self.checkIn",
  input: z.object({
    code: z.string().refine(isCheckInCode, "That isn't a check-in code."),
  }),
  run: async ({ code }, viewer): Promise<CheckInResult> => {
    if (!(await takeRateLimit("checkIn", viewer.userId))) {
      throw new Refusal("Too many tries. Ask the front desk to mark you in.");
    }

    const result = await withUserContext(getDb(), viewer.userId, (tx) =>
      tx.execute(sql`select public.check_in(${code}) as status`),
    );
    const status = rowsOf<{ status: CheckInResult["status"] }>(result)[0]
      .status;

    const membership = await getOwnMembership(viewer);
    const payments = membership
      ? await getMemberPayments(viewer, membership.memberId)
      : null;

    return {
      status,
      firstName: (membership?.fullName ?? viewer.fullName).split(" ")[0],
      owedPaise: payments?.ledger?.owedPaise ?? 0,
    };
  },
});

export const markAttendance = guardedAction({
  permission: "attendance.mark",
  input: z.object({ memberId: z.uuid() }),
  run: async ({ memberId }, viewer) => {
    const message = await withUserContext(
      getDb(),
      viewer.userId,
      async (tx) => {
        const [member] = await tx
          .select({ isActive: members.isActive, fullName: members.fullName })
          .from(members)
          .where(eq(members.id, memberId));
        if (!member) throw new Refusal("That member no longer exists.");
        if (!member.isActive) {
          throw new Refusal(
            `${member.fullName} is marked inactive. Reactivate them first.`,
          );
        }
        const inserted = await tx
          .insert(attendance)
          .values({ memberId, method: "manual", markedBy: viewer.userId })
          .onConflictDoNothing()
          .returning({ id: attendance.id });
        return inserted.length
          ? `${member.fullName} marked in.`
          : `${member.fullName} was already in today.`;
      },
    );
    return { message };
  },
});

export const createDeskDisplay = guardedAction({
  permission: "desk.manage",
  input: z.object({
    label: z
      .string()
      .trim()
      .min(1, "Give the device a name, like Front desk tablet")
      .max(40, "Keep the name under 40 characters"),
  }),
  run: async ({ label }, viewer) => {
    const token = randomBytes(32).toString("base64url");
    await withUserContext(getDb(), viewer.userId, (tx) =>
      tx.execute(sql`select public.create_desk_display(${label}, ${token})`),
    );
    return {
      url: new URL(
        `/desk/${token}`,
        publicEnv().NEXT_PUBLIC_SITE_URL,
      ).toString(),
    };
  },
});

export const revokeDeskDisplay = guardedAction({
  permission: "desk.manage",
  input: z.object({ displayId: z.uuid() }),
  run: async ({ displayId }, viewer) => {
    await withUserContext(getDb(), viewer.userId, (tx) =>
      tx.execute(sql`select public.revoke_desk_display(${displayId})`),
    );
    return { message: "Switched off. That device now shows nothing." };
  },
});

export const setPrintedQr = guardedAction({
  permission: "checkin.settings",
  input: z.object({
    enabled: z.enum(["true", "false"]).transform((value) => value === "true"),
  }),
  run: async ({ enabled }, viewer) => {
    await withUserContext(getDb(), viewer.userId, (tx) =>
      tx.update(gymSettings).set({ printedQrEnabled: enabled }),
    );
    return {
      message: enabled
        ? "The printed QR works again."
        : "The printed QR is off. Only the desk display checks people in now.",
    };
  },
});

const clockTime = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Pick a time");

export const saveBatches = guardedAction({
  permission: "checkin.settings",
  input: z
    .object({
      morningOpens: clockTime,
      morningCloses: clockTime,
      eveningOpens: clockTime,
      eveningCloses: clockTime,
    })
    .refine(
      (hours) =>
        hours.morningOpens < hours.morningCloses &&
        hours.morningCloses <= hours.eveningOpens &&
        hours.eveningOpens < hours.eveningCloses,
      "Each batch must close after it opens, and the morning must end before the evening starts.",
    ),
  run: async (hours, viewer) => {
    await withUserContext(getDb(), viewer.userId, (tx) =>
      tx.update(gymSettings).set(hours),
    );
    return { message: "Saved. Check-ins outside these hours are refused." };
  },
});

export const regeneratePrintedCode = guardedAction({
  permission: "checkin.settings",
  input: z.object({}),
  run: async (_input, viewer) => {
    await withUserContext(getDb(), viewer.userId, (tx) =>
      tx.execute(sql`select public.regenerate_printed_checkin_code()`),
    );
    return { message: "New code made. Print it and replace the old sheet." };
  },
});
