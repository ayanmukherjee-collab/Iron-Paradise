// Browser versions of src/members/actions.ts, same names and inputs. The
// shared forms import "@/members/actions"; web/vite.config.mts points that
// here. Each save is one database call where the server used a transaction.
import { z } from "zod";
import { formatDate, todayAtGym } from "@/lib/dates";
import { feeChangeEffectiveFrom } from "@/members/billing";
import {
  checkbox,
  feeRupees,
  fullName,
  isoDate,
  mobile,
  optionalNote,
  optionalPlanId,
} from "@/members/schemas";
import { dataOf, Refusal } from "../data/action";
import { rpc, table } from "../data/db";
import { guardedAction } from "../data/guarded";
import { loadFacts, membershipRow } from "../data/ledgers";
import { moveDueDate } from "../data/due-dates";
import { env } from "../lib/env";

const newMemberFields = {
  fullName,
  phone: mobile,
  startsOn: isoDate,
  planId: optionalPlanId,
  fee: feeRupees,
  reminderConsent: checkbox,
};

export const addMember = guardedAction({
  permission: "members.edit",
  input: z.object(newMemberFields),
  run: async (input) => {
    const memberId = await rpc<string>("add_member", {
      full_name: input.fullName,
      phone: input.phone,
      starts_on: input.startsOn,
      plan_id: input.planId,
      fee_paise: input.fee,
      reminder_consent: input.reminderConsent,
    });
    return { redirectTo: `/app/members/${memberId}` };
  },
});

export const updateMember = guardedAction({
  permission: "members.edit",
  input: z.object({
    memberId: z.uuid(),
    fullName,
    phone: mobile,
    remindersMuted: checkbox,
    reminderConsent: checkbox,
  }),
  run: async ({ memberId, reminderConsent, ...fields }) => {
    // Keep the original date when consent was already recorded.
    const current = dataOf(
      await table("members")
        .select("reminder_consent_at")
        .eq("id", memberId)
        .maybeSingle(),
    ) as { reminder_consent_at: string | null } | null;
    if (!current) throw new Refusal("That member no longer exists.");
    dataOf(
      await table("members")
        .update({
          full_name: fields.fullName,
          phone: fields.phone,
          reminders_muted: fields.remindersMuted,
          reminder_consent_at: reminderConsent
            ? (current.reminder_consent_at ?? new Date().toISOString())
            : null,
        })
        .eq("id", memberId),
    );
  },
});

export const changeFee = guardedAction({
  permission: "memberships.edit",
  input: z.object({
    memberId: z.uuid(),
    membershipId: z.uuid(),
    fee: feeRupees,
    note: optionalNote,
  }),
  run: async ({ membershipId, fee, note }, viewer) => {
    const row = await membershipRow(membershipId);
    if (!row || row.endedOn) {
      throw new Refusal(
        "This membership has ended. Reactivate the member first.",
      );
    }
    const facts = (await loadFacts([row], true)).get(row.id)!;
    const from = feeChangeEffectiveFrom(facts, todayAtGym());
    dataOf(
      await table("membership_fees").insert({
        membership_id: membershipId,
        fee_paise: fee,
        effective_from: from,
        note,
        set_by: viewer.userId,
      }),
    );
    return { message: `Saved. Applies from ${formatDate(from)}.` };
  },
});

export const changeDueDate = guardedAction({
  permission: "memberships.edit",
  input: z.object({
    memberId: z.uuid(),
    membershipId: z.uuid(),
    dueOn: isoDate,
  }),
  run: async ({ membershipId, dueOn }) => {
    const { changes } = await moveDueDate(membershipId, dueOn, todayAtGym());
    dataOf(
      await table("memberships")
        .update({ due_changes: changes })
        .eq("id", membershipId),
    );
    return { message: `Saved. Next due ${formatDate(dueOn)}.` };
  },
});

export const freezeMembership = guardedAction({
  permission: "memberships.edit",
  input: z
    .object({
      memberId: z.uuid(),
      membershipId: z.uuid(),
      startsOn: isoDate,
      endsOn: z
        .union([z.literal(""), isoDate])
        .transform((value) => value || null),
      note: optionalNote,
    })
    .refine((input) => !input.endsOn || input.endsOn >= input.startsOn, {
      message: "The freeze must end on or after the day it starts",
    }),
  run: async ({ membershipId, startsOn, endsOn, note }, viewer) => {
    dataOf(
      await table("membership_freezes").insert({
        membership_id: membershipId,
        starts_on: startsOn,
        ends_on: endsOn,
        note,
        created_by: viewer.userId,
      }),
    );
  },
});

export const endFreeze = guardedAction({
  permission: "memberships.edit",
  input: z.object({ memberId: z.uuid(), freezeId: z.uuid(), endsOn: isoDate }),
  run: async ({ freezeId, endsOn }) => {
    dataOf(
      await table("membership_freezes")
        .update({ ends_on: endsOn })
        .eq("id", freezeId),
    );
  },
});

export const deactivateMember = guardedAction({
  permission: "members.edit",
  input: z.object({ memberId: z.uuid() }),
  run: async ({ memberId }) => {
    await rpc("deactivate_member", { target_member: memberId });
  },
});

export const reactivateMember = guardedAction({
  permission: "members.edit",
  input: z.object({
    memberId: z.uuid(),
    startsOn: isoDate,
    planId: optionalPlanId,
    fee: feeRupees,
  }),
  run: async ({ memberId, startsOn, planId, fee }) => {
    await rpc("reactivate_member", {
      target_member: memberId,
      starts_on: startsOn,
      plan_id: planId,
      fee_paise: fee,
    });
  },
});

export const deleteMember = guardedAction({
  permission: "members.delete",
  input: z.object({
    memberId: z.uuid(),
    confirmCode: z
      .string()
      .trim()
      .min(1, "Type the member ID to confirm")
      .max(20),
  }),
  run: async ({ memberId, confirmCode }) => {
    await rpc("delete_member", {
      target: memberId,
      confirm_code: confirmCode,
    });
    return { redirectTo: "/app/members" };
  },
});

/** A random token for a one-time link; only its hash is stored. */
function randomToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let text = "";
  for (const byte of bytes) text += String.fromCharCode(byte);
  return btoa(text).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export { randomToken };

export const createClaimLink = guardedAction({
  permission: "guests.link",
  input: z.object({ memberId: z.uuid() }),
  run: async ({ memberId }) => {
    const token = randomToken();
    const expiresAt = await rpc<string>("issue_claim_token", {
      target_member: memberId,
      raw_token: token,
    });
    return {
      url: new URL(`/claim/${token}`, env.siteUrl).toString(),
      expiresAt: new Date(expiresAt).toISOString(),
    };
  },
});

export const linkGuest = guardedAction({
  permission: "guests.link",
  input: z.object({
    profileId: z.uuid(),
    memberId: z.uuid("Pick the member record to link"),
  }),
  run: async ({ profileId, memberId }) => {
    await rpc("link_guest_to_member", {
      target_profile: profileId,
      target_member: memberId,
    });
  },
});

export const convertGuest = guardedAction({
  permission: "guests.link",
  input: z.object({
    profileId: z.uuid(),
    fullName: z.string().trim().min(1, "Enter their name").max(120),
    phone: mobile,
    startsOn: isoDate,
    planId: optionalPlanId,
    fee: feeRupees,
    reminderConsent: checkbox,
  }),
  run: async (input) => {
    const memberId = await rpc<string>("convert_guest", {
      target_profile: input.profileId,
      full_name: input.fullName,
      phone: input.phone,
      starts_on: input.startsOn,
      plan_id: input.planId,
      fee_paise: input.fee,
      reminder_consent: input.reminderConsent,
    });
    return { redirectTo: `/app/members/${memberId}` };
  },
});

export const savePlan = guardedAction({
  permission: "plans.edit",
  input: z.object({
    planId: optionalPlanId,
    name: z.string().trim().min(1, "Name the plan").max(60),
    durationMonths: z.coerce.number().int().min(1).max(24),
    defaultFee: feeRupees,
    isActive: checkbox,
  }),
  run: async ({ planId, name, durationMonths, defaultFee, isActive }) => {
    dataOf(
      planId
        ? await table("plans")
            .update({
              name,
              duration_months: durationMonths,
              default_fee_paise: defaultFee,
              is_active: isActive,
            })
            .eq("id", planId)
        : await table("plans").insert({
            name,
            duration_months: durationMonths,
            default_fee_paise: defaultFee,
          }),
    );
  },
});

export const saveGoneQuietDays = guardedAction({
  permission: "plans.edit",
  input: z.object({
    days: z.coerce
      .number("Enter a number of days")
      .int()
      .min(7, "Use at least 7 days")
      .max(180, "Use at most 180 days"),
  }),
  run: async ({ days }) => {
    // gym_settings has exactly one row, keyed true.
    dataOf(
      await table("gym_settings")
        .update({ gone_quiet_days: days })
        .eq("id", true),
    );
  },
});
