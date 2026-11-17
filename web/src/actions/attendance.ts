// Browser versions of src/attendance/actions.ts.
import { z } from "zod";
import type { CheckInResult } from "@/attendance/types";
import { isCheckInCode } from "@/attendance/code";
import { dataOf, Refusal } from "../data/action";
import { rpc, table } from "../data/db";
import { guardedAction } from "../data/guarded";
import { getOwnStanding } from "../data/own-standing";
import { env } from "../lib/env";
import { randomToken } from "./members";

export type { CheckInResult };

/**
 * public.check_in checks the code, the opening hours and the member, and
 * records the visit once a day. The Upstash rate limit the server added is
 * gone; a second scan the same day changes nothing.
 */
export const checkIn = guardedAction({
  permission: "self.checkIn",
  input: z.object({
    code: z.string().refine(isCheckInCode, "That isn't a check-in code."),
  }),
  run: async ({ code }, viewer): Promise<CheckInResult> => {
    const status = await rpc<CheckInResult["status"]>("check_in", { code });
    const standing = await getOwnStanding(viewer.userId);
    return {
      status,
      firstName: (standing.fullName ?? viewer.fullName).split(" ")[0],
      owedPaise: standing.owedPaise,
    };
  },
});

export const markAttendance = guardedAction({
  permission: "attendance.mark",
  input: z.object({ memberId: z.uuid() }),
  run: async ({ memberId }, viewer) => {
    const member = dataOf(
      await table("members")
        .select("is_active, full_name")
        .eq("id", memberId)
        .maybeSingle(),
    ) as { is_active: boolean; full_name: string } | null;
    if (!member) throw new Refusal("That member no longer exists.");
    if (!member.is_active) {
      throw new Refusal(
        `${member.full_name} is marked inactive. Reactivate them first.`,
      );
    }
    const { error } = await table("attendance").insert({
      member_id: memberId,
      method: "manual",
      marked_by: viewer.userId,
    });
    // One visit a day: the unique key says they're already in.
    if (error?.code === "23505")
      return { message: `${member.full_name} was already in today.` };
    dataOf({ data: null, error });
    return { message: `${member.full_name} marked in.` };
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
  run: async ({ label }) => {
    const token = randomToken();
    await rpc("create_desk_display", {
      display_label: label,
      raw_token: token,
    });
    return { url: new URL(`/desk/${token}`, env.siteUrl).toString() };
  },
});

export const revokeDeskDisplay = guardedAction({
  permission: "desk.manage",
  input: z.object({ displayId: z.uuid() }),
  run: async ({ displayId }) => {
    await rpc("revoke_desk_display", { display: displayId });
    return { message: "Switched off. That device now shows nothing." };
  },
});

export const setPrintedQr = guardedAction({
  permission: "checkin.settings",
  input: z.object({
    enabled: z.enum(["true", "false"]).transform((value) => value === "true"),
  }),
  run: async ({ enabled }) => {
    dataOf(
      await table("gym_settings")
        .update({ printed_qr_enabled: enabled })
        .eq("id", true),
    );
    return {
      message: enabled
        ? "The printed QR works again."
        : "The printed QR is off. Only the desk display checks people in now.",
    };
  },
});

export const regeneratePrintedCode = guardedAction({
  permission: "checkin.settings",
  input: z.object({}),
  run: async () => {
    await rpc("regenerate_printed_checkin_code");
    return { message: "New code made. Print it and replace the old sheet." };
  },
});
