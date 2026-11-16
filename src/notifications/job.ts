import "server-only";
import { and, eq, inArray, sql } from "drizzle-orm";
import { notifications, pushSubscriptions } from "@/db/schema";
import type { Database } from "@/db/user-context";
import { todayAtGym } from "@/lib/dates";
import {
  loadReminderCandidates,
  mayRemind,
  type ReminderCandidate,
} from "@/notifications/candidates";
import type { Channel, Recipient } from "@/notifications/channels/types";
import { reminderMessage } from "@/notifications/message";
import { reminderFor, type DueReminder } from "@/notifications/schedule";
import type { PushTarget } from "@/notifications/web-push";

/**
 * Outgoing requests one run may make. Cloudflare's free plan allows 50 per
 * invocation and the database connection takes one; the rest is headroom.
 * Whatever does not fit waits for the next run (the cron fires several times
 * each morning), which picks up where this one stopped.
 */
export const defaultSendBudget = 40;

export interface JobResult {
  today: string;
  /** Members due a reminder today on at least one channel. */
  due: number;
  sent: number;
  failed: number;
  /** Already sent by an earlier run. */
  alreadySent: number;
  /** Left for the next run because this one hit its request budget. */
  deferred: number;
}

/**
 * The daily reminder run (brief §4.6). Safe to run any number of times a day:
 * each (fee, stage, channel) is claimed in the log before sending, and the
 * log's unique key turns a second claim into a no-op.
 *
 * Runs on the server's own database connection, not as a user: there is no
 * signed-in person behind a scheduled job. The cron route that calls it
 * checks a shared secret first.
 */
export async function runReminders(
  db: Database,
  channels: Channel[],
  options: { now?: Date; budget?: number } = {},
): Promise<JobResult> {
  const today = todayAtGym(options.now);
  let budget = options.budget ?? defaultSendBudget;
  const result: JobResult = {
    today,
    due: 0,
    sent: 0,
    failed: 0,
    alreadySent: 0,
    deferred: 0,
  };
  if (channels.length === 0) return result;

  const { candidates, targets } = await db.transaction(async (tx) => {
    const candidates = await loadReminderCandidates(tx, today);
    const profileIds = candidates.flatMap((c) =>
      c.profileId ? [c.profileId] : [],
    );
    const subscriptions = profileIds.length
      ? await tx
          .select()
          .from(pushSubscriptions)
          .where(inArray(pushSubscriptions.profileId, profileIds))
      : [];
    const targets = new Map<string, PushTarget[]>();
    for (const { profileId, endpoint, p256dh, auth } of subscriptions) {
      targets.set(profileId, [
        ...(targets.get(profileId) ?? []),
        { endpoint, p256dh, auth },
      ]);
    }
    return { candidates, targets };
  });

  for (const candidate of candidates) {
    if (!mayRemind(candidate)) continue;
    const reminder = reminderFor(candidate.ledger, today, "automatic");
    if (!reminder) continue;

    const recipient = toRecipient(candidate, targets);
    const reachable = channels.filter((channel) => channel.reaches(recipient));
    if (reachable.length > 0) result.due++;

    for (const channel of reachable) {
      const cost = channel.cost(recipient);
      if (cost > budget) {
        result.deferred++;
        continue;
      }
      const outcome = await sendOnce(db, channel, candidate, recipient, {
        reminder,
        today,
      });
      if (outcome === "already") {
        result.alreadySent++;
        continue;
      }
      budget -= cost;
      result[outcome]++;
    }
  }
  return result;
}

function toRecipient(
  candidate: ReminderCandidate,
  targets: Map<string, PushTarget[]>,
): Recipient {
  return {
    memberId: candidate.memberId,
    fullName: candidate.fullName,
    memberCode: candidate.memberCode,
    email: candidate.email,
    pushTargets: candidate.profileId
      ? (targets.get(candidate.profileId) ?? [])
      : [],
  };
}

async function sendOnce(
  db: Database,
  channel: Channel,
  candidate: ReminderCandidate,
  recipient: Recipient,
  { reminder, today }: { reminder: DueReminder; today: string },
): Promise<"sent" | "failed" | "already"> {
  const [claimed] = await db
    .insert(notifications)
    .values({
      memberId: candidate.memberId,
      membershipId: candidate.membershipId,
      period: reminder.period,
      stage: reminder.stage,
      channel: channel.name,
      dueOn: reminder.dueOn,
      amountPaise: reminder.amountPaise,
    })
    .onConflictDoNothing()
    .returning({ id: notifications.id });
  if (!claimed) return "already";

  const delivery = await channel
    .send(recipient, {
      reminder,
      message: reminderMessage(reminder, today),
      today,
      notificationId: claimed.id,
    })
    .catch((error: unknown) => ({
      ok: false as const,
      error: error instanceof Error ? error.message : "Send failed",
      expiredEndpoints: undefined,
    }));

  await db
    .update(notifications)
    .set({
      status: delivery.ok ? "sent" : "failed",
      error: delivery.ok
        ? null
        : (delivery.error ?? "Send failed").slice(0, 300),
      finishedAt: sql`now()`,
    })
    .where(
      and(
        eq(notifications.id, claimed.id),
        eq(notifications.status, "sending"),
      ),
    );

  if (delivery.expiredEndpoints?.length) {
    await db
      .delete(pushSubscriptions)
      .where(inArray(pushSubscriptions.endpoint, delivery.expiredEndpoints));
  }
  return delivery.ok ? "sent" : "failed";
}
