"use server";

// Every export here is a public HTTP endpoint. Export only guardedAction
// results; helpers live in queries.ts, schemas.ts and schedule.ts.
import { and, eq, isNull, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { guardedAction } from "@/auth/guarded-action";
import { getDb } from "@/db/client";
import {
  members,
  memberships,
  notifications,
  pushSubscriptions,
} from "@/db/schema";
import { withUserContext } from "@/db/user-context";
import { todayAtGym } from "@/lib/dates";
import { activeFreeze, feeOn } from "@/members/billing";
import { getMembershipFacts } from "@/members/queries";
import { reminderFor } from "@/notifications/schedule";
import { pushEndpoint, pushSubscription } from "@/notifications/schemas";
import { ledgerInTransaction } from "@/payments/queries";

class NothingToRemindError extends Error {
  code = "P0001";
}

/**
 * Records that a staff member opened WhatsApp to remind a member. The page
 * opens WhatsApp itself; this only logs it. What is owed is worked out again
 * here rather than trusted from the page.
 */
export const logWhatsAppReminder = guardedAction({
  permission: "reminders.send",
  input: z.object({ membershipId: z.uuid() }),
  run: async ({ membershipId }, viewer) => {
    const today = todayAtGym();
    const logged = await withUserContext(getDb(), viewer.userId, async (tx) => {
      const [[member], facts, { ledger, memberId }] = await Promise.all([
        tx
          .select({
            isActive: members.isActive,
            consentAt: members.reminderConsentAt,
            muted: members.remindersMuted,
          })
          .from(memberships)
          .innerJoin(members, eq(members.id, memberships.memberId))
          .where(
            and(eq(memberships.id, membershipId), isNull(memberships.endedOn)),
          ),
        getMembershipFacts(tx, membershipId),
        ledgerInTransaction(tx, membershipId, today),
      ]);
      if (!member?.isActive || !facts?.fees) {
        throw new NothingToRemindError("This member isn't active any more.");
      }
      if (!member.consentAt || member.muted) {
        throw new NothingToRemindError(
          "This member hasn't agreed to reminders, or they are muted.",
        );
      }
      if (
        activeFreeze(facts.freezes, today) ||
        feeOn(facts.fees, today) === 0
      ) {
        throw new NothingToRemindError(
          "Frozen and free members get no reminders.",
        );
      }
      const reminder = reminderFor(ledger, today, "staff");
      if (!reminder) {
        throw new NothingToRemindError("Nothing is due for this member now.");
      }

      const rows = await tx
        .insert(notifications)
        .values({
          memberId,
          membershipId,
          period: reminder.period,
          stage: reminder.stage,
          channel: "whatsapp",
          status: "sent",
          dueOn: reminder.dueOn,
          amountPaise: reminder.amountPaise,
          sentBy: viewer.userId,
          finishedAt: sql`now()`,
        })
        .onConflictDoNothing()
        .returning({ id: notifications.id });
      return rows.length > 0;
    });
    revalidatePath("/app/reminders");
    return {
      message: logged ? "Logged as sent." : "Already logged for this due date.",
    };
  },
});

/** Turns on push reminders in the browser the member is using. */
export const savePushSubscription = guardedAction({
  permission: "self.view",
  input: pushSubscription,
  run: async ({ endpoint, p256dh, auth }, viewer) => {
    await withUserContext(getDb(), viewer.userId, (tx) =>
      tx.execute(
        sql`select public.save_push_subscription(${endpoint}, ${p256dh}, ${auth})`,
      ),
    );
    return { message: "Reminders are on for this phone." };
  },
});

export const removePushSubscription = guardedAction({
  permission: "self.view",
  input: z.object({ endpoint: pushEndpoint }),
  run: async ({ endpoint }, viewer) => {
    // RLS limits the delete to the caller's own subscriptions.
    await withUserContext(getDb(), viewer.userId, (tx) =>
      tx
        .delete(pushSubscriptions)
        .where(eq(pushSubscriptions.endpoint, endpoint)),
    );
    return { message: "Reminders are off for this phone." };
  },
});
