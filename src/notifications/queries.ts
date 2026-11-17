import "server-only";
import { desc, eq, inArray } from "drizzle-orm";
import type { Viewer } from "@/auth/viewer";
import { getDb } from "@/db/client";
import { members, notifications, profiles } from "@/db/schema";
import { withUserContext } from "@/db/user-context";
import { todayAtGym, type IsoDate } from "@/lib/dates";
import { loadReminderCandidates, mayRemind } from "@/notifications/candidates";
import { staffWhatsAppLink } from "@/notifications/channels/whatsapp";
import {
  reminderFor,
  type DueReminder,
  type ReminderStage,
} from "@/notifications/schedule";

export type Channel = "push" | "email" | "whatsapp";
export type Status = "sending" | "sent" | "failed";

export interface SentReminder {
  channel: Channel;
  stage: ReminderStage;
  status: Status;
  at: Date;
}

export interface QueueItem {
  memberId: string;
  memberCode: string;
  fullName: string;
  membershipId: string;
  reminder: DueReminder;
  whatsAppLink: string;
  /** When staff already sent the WhatsApp for this fee at this stage. */
  whatsAppSentAt: Date | null;
  /** Everything already sent about this fee, newest first. */
  sent: SentReminder[];
}

export interface ReminderQueue {
  today: IsoDate;
  items: QueueItem[];
  /** Members who owe but get no reminders, and why. */
  heldBack: { noConsent: number; muted: number };
}

/**
 * Members a staff member could remind on WhatsApp right now: everyone due
 * within 3 days, due today or overdue (however long), whom reminders are
 * allowed for. Overdue first, then by due date.
 */
export async function getReminderQueue(viewer: Viewer): Promise<ReminderQueue> {
  const today = todayAtGym();
  return withUserContext(getDb(), viewer.userId, async (tx) => {
    const candidates = await loadReminderCandidates(tx, today);

    const heldBack = { noConsent: 0, muted: 0 };
    const due = candidates.flatMap((candidate) => {
      if (candidate.frozen || candidate.free) return [];
      const reminder = reminderFor(candidate.ledger, today, "staff");
      if (!reminder) return [];
      if (!mayRemind(candidate)) {
        if (candidate.muted) heldBack.muted++;
        else heldBack.noConsent++;
        return [];
      }
      return [{ candidate, reminder }];
    });

    const log = due.length
      ? await tx
          .select({
            membershipId: notifications.membershipId,
            period: notifications.period,
            channel: notifications.channel,
            stage: notifications.stage,
            status: notifications.status,
            at: notifications.createdAt,
          })
          .from(notifications)
          .where(
            inArray(
              notifications.membershipId,
              due.map(({ candidate }) => candidate.membershipId),
            ),
          )
          .orderBy(desc(notifications.createdAt))
      : [];

    const items = due.map(({ candidate, reminder }): QueueItem => {
      const sent = log.filter(
        (row) =>
          row.membershipId === candidate.membershipId &&
          row.period === reminder.period,
      );
      return {
        memberId: candidate.memberId,
        memberCode: candidate.memberCode,
        fullName: candidate.fullName,
        membershipId: candidate.membershipId,
        reminder,
        whatsAppLink: staffWhatsAppLink({ ...candidate, reminder, today }),
        whatsAppSentAt:
          sent.find(
            (row) => row.channel === "whatsapp" && row.stage === reminder.stage,
          )?.at ?? null,
        sent: sent.map(({ channel, stage, status, at }) => ({
          channel,
          stage,
          status,
          at,
        })),
      };
    });

    const urgency: Record<ReminderStage, number> = {
      overdue: 0,
      due_today: 1,
      due_soon: 2,
    };
    items.sort(
      (a, b) =>
        urgency[a.reminder.stage] - urgency[b.reminder.stage] ||
        a.reminder.dueOn.localeCompare(b.reminder.dueOn) ||
        a.fullName.localeCompare(b.fullName),
    );
    return { today, items, heldBack };
  });
}

export interface LogEntry {
  id: string;
  at: Date;
  memberId: string;
  memberCode: string;
  fullName: string;
  channel: Channel;
  stage: ReminderStage;
  status: Status;
  dueOn: IsoDate;
  amountPaise: number;
  error: string | null;
  /** Null when the daily job sent it. */
  sentBy: string | null;
}

/** The notification log, newest first (brief §4.6). */
export async function listNotificationLog(
  viewer: Viewer,
  limit = 100,
): Promise<LogEntry[]> {
  return withUserContext(getDb(), viewer.userId, (tx) =>
    tx
      .select({
        id: notifications.id,
        at: notifications.createdAt,
        memberId: notifications.memberId,
        memberCode: members.memberCode,
        fullName: members.fullName,
        channel: notifications.channel,
        stage: notifications.stage,
        status: notifications.status,
        dueOn: notifications.dueOn,
        amountPaise: notifications.amountPaise,
        error: notifications.error,
        sentBy: profiles.fullName,
      })
      .from(notifications)
      .innerJoin(members, eq(members.id, notifications.memberId))
      .leftJoin(profiles, eq(profiles.id, notifications.sentBy))
      .orderBy(desc(notifications.createdAt))
      .limit(limit),
  );
}
