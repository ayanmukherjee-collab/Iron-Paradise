"use server";

// Every export here is a public HTTP endpoint. Export only guardedAction
// results; helpers live in queries.ts and schemas.ts.
import { randomBytes } from "node:crypto";
import { and, eq, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { guardedAction } from "@/auth/guarded-action";
import { getDb } from "@/db/client";
import {
  gymSettings,
  members,
  membershipFees,
  membershipFreezes,
  memberships,
  plans,
  profiles,
} from "@/db/schema";
import {
  rowsOf,
  withUserContext,
  type UserTransaction,
} from "@/db/user-context";
import { formatDate, todayAtGym, type IsoDate } from "@/lib/dates";
import { publicEnv } from "@/lib/env";
import { feeChangeEffectiveFrom } from "@/members/billing";
import { getMembershipFacts } from "@/members/queries";
import {
  checkbox,
  feeRupees,
  fullName,
  isoDate,
  mobile,
  optionalNote,
  optionalPlanId,
} from "@/members/schemas";

async function startMembership(
  tx: UserTransaction,
  input: {
    memberId: string;
    startsOn: IsoDate;
    planId: string | null;
    feePaise: number;
    createdBy: string;
  },
) {
  const [membership] = await tx
    .insert(memberships)
    .values({
      memberId: input.memberId,
      planId: input.planId,
      startsOn: input.startsOn,
      createdBy: input.createdBy,
    })
    .returning({ id: memberships.id });
  await tx.insert(membershipFees).values({
    membershipId: membership.id,
    feePaise: input.feePaise,
    effectiveFrom: input.startsOn,
    setBy: input.createdBy,
  });
}

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
  run: async (input, viewer) => {
    const memberId = await withUserContext(
      getDb(),
      viewer.userId,
      async (tx) => {
        const [member] = await tx
          .insert(members)
          .values({
            fullName: input.fullName,
            phone: input.phone,
            reminderConsentAt: input.reminderConsent ? new Date() : null,
            createdBy: viewer.userId,
          })
          .returning({ id: members.id });
        await startMembership(tx, {
          memberId: member.id,
          startsOn: input.startsOn,
          planId: input.planId,
          feePaise: input.fee,
          createdBy: viewer.userId,
        });
        return member.id;
      },
    );
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
  run: async ({ memberId, reminderConsent, ...fields }, viewer) => {
    await withUserContext(getDb(), viewer.userId, (tx) =>
      tx
        .update(members)
        .set({
          ...fields,
          // Keep the original date when consent was already recorded.
          reminderConsentAt: reminderConsent
            ? sql`coalesce(${members.reminderConsentAt}, now())`
            : null,
        })
        .where(eq(members.id, memberId)),
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
    const effectiveFrom = await withUserContext(
      getDb(),
      viewer.userId,
      async (tx) => {
        const facts = await getMembershipFacts(tx, membershipId);
        if (!facts || facts.endedOn) throw new MembershipEndedError();
        const from = feeChangeEffectiveFrom(facts, todayAtGym());
        await tx.insert(membershipFees).values({
          membershipId,
          feePaise: fee,
          effectiveFrom: from,
          note,
          setBy: viewer.userId,
        });
        return from;
      },
    );
    return { message: `Saved. Applies from ${formatDate(effectiveFrom)}.` };
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
    await withUserContext(getDb(), viewer.userId, (tx) =>
      tx.insert(membershipFreezes).values({
        membershipId,
        startsOn,
        endsOn,
        note,
        createdBy: viewer.userId,
      }),
    );
  },
});

export const endFreeze = guardedAction({
  permission: "memberships.edit",
  input: z.object({ memberId: z.uuid(), freezeId: z.uuid(), endsOn: isoDate }),
  run: async ({ freezeId, endsOn }, viewer) => {
    await withUserContext(getDb(), viewer.userId, (tx) =>
      tx
        .update(membershipFreezes)
        .set({ endsOn })
        .where(eq(membershipFreezes.id, freezeId)),
    );
  },
});

// "Remove" never deletes (brief §3): the member is marked inactive and their
// membership ends today. Coming back starts a new membership, so the months
// they were away are never billed.
export const deactivateMember = guardedAction({
  permission: "members.edit",
  input: z.object({ memberId: z.uuid() }),
  run: async ({ memberId }, viewer) => {
    await withUserContext(getDb(), viewer.userId, async (tx) => {
      await tx
        .update(members)
        .set({ isActive: false })
        .where(eq(members.id, memberId));
      await tx
        .update(memberships)
        .set({ endedOn: todayAtGym() })
        .where(
          and(eq(memberships.memberId, memberId), isNull(memberships.endedOn)),
        );
    });
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
  run: async ({ memberId, startsOn, planId, fee }, viewer) => {
    await withUserContext(getDb(), viewer.userId, async (tx) => {
      await tx
        .update(members)
        .set({ isActive: true })
        .where(eq(members.id, memberId));
      await startMembership(tx, {
        memberId,
        startsOn,
        planId,
        feePaise: fee,
        createdBy: viewer.userId,
      });
    });
  },
});

// Permanent, owner only, and only for a member already marked inactive. The
// whole erase is one call to public.erase_member, which re-checks the owner,
// the inactive flag and the typed member code inside Postgres, so the Worker
// sends a single query and a forged request gets no further than the form.
export const eraseMember = guardedAction({
  permission: "members.erase",
  input: z.object({
    memberId: z.uuid(),
    confirmCode: z
      .string()
      .trim()
      .min(1, "Type the member's ID to confirm")
      .max(20),
  }),
  run: async ({ memberId, confirmCode }, viewer) => {
    await withUserContext(getDb(), viewer.userId, (tx) =>
      tx.execute(sql`select public.erase_member(${memberId}, ${confirmCode})`),
    );
    return { redirectTo: "/app/members" };
  },
});

// The raw token exists only in this response: the database keeps a hash, so
// the link can be shown once and never looked up again. Lost links are
// replaced by generating a new one, which cancels the old.
export const createClaimLink = guardedAction({
  permission: "guests.link",
  input: z.object({ memberId: z.uuid() }),
  run: async ({ memberId }, viewer) => {
    const token = randomBytes(32).toString("base64url");
    const result = await withUserContext(getDb(), viewer.userId, (tx) =>
      tx.execute(
        sql`select public.issue_claim_token(${memberId}, ${token}) as expires_at`,
      ),
    );
    const [row] = rowsOf<{ expires_at: string | Date }>(result);
    return {
      url: new URL(
        `/claim/${token}`,
        publicEnv().NEXT_PUBLIC_SITE_URL,
      ).toString(),
      expiresAt: new Date(row.expires_at).toISOString(),
    };
  },
});

export const linkGuest = guardedAction({
  permission: "guests.link",
  input: z.object({
    profileId: z.uuid(),
    memberId: z.uuid("Pick the member record to link"),
  }),
  run: async ({ profileId, memberId }, viewer) => {
    await withUserContext(getDb(), viewer.userId, (tx) =>
      tx.execute(
        sql`select public.link_guest_to_member(${profileId}, ${memberId})`,
      ),
    );
  },
});

// One tap for a guest who isn't on the books yet: creates their member
// record (the name staff typed, which starts as their Google name) and
// links the account in one transaction.
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
  run: async (input, viewer) => {
    const memberId = await withUserContext(
      getDb(),
      viewer.userId,
      async (tx) => {
        const [guest] = await tx
          .select({ id: profiles.id })
          .from(profiles)
          .where(eq(profiles.id, input.profileId));
        if (!guest) throw new GuestNotFoundError();

        const [member] = await tx
          .insert(members)
          .values({
            fullName: input.fullName,
            phone: input.phone,
            reminderConsentAt: input.reminderConsent ? new Date() : null,
            createdBy: viewer.userId,
          })
          .returning({ id: members.id });
        await startMembership(tx, {
          memberId: member.id,
          startsOn: input.startsOn,
          planId: input.planId,
          feePaise: input.fee,
          createdBy: viewer.userId,
        });
        await tx.execute(
          sql`select public.link_guest_to_member(${input.profileId}, ${member.id})`,
        );
        return member.id;
      },
    );
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
  run: async (
    { planId, name, durationMonths, defaultFee, isActive },
    viewer,
  ) => {
    await withUserContext(getDb(), viewer.userId, (tx) =>
      planId
        ? tx
            .update(plans)
            .set({
              name,
              durationMonths,
              defaultFeePaise: defaultFee,
              isActive,
            })
            .where(eq(plans.id, planId))
        : tx
            .insert(plans)
            .values({ name, durationMonths, defaultFeePaise: defaultFee }),
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
  run: async ({ days }, viewer) => {
    await withUserContext(getDb(), viewer.userId, (tx) =>
      tx.update(gymSettings).set({ goneQuietDays: days }),
    );
  },
});

class MembershipEndedError extends Error {
  code = "P0001";
  constructor() {
    super("This membership has ended. Reactivate the member first.");
  }
}

class GuestNotFoundError extends Error {
  code = "P0002";
  constructor() {
    super("That guest account no longer exists.");
  }
}
