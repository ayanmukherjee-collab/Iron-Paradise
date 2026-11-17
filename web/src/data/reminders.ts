// Browser versions of src/notifications/queries.ts (staff WhatsApp queue
// and log) and loadReminderCandidates.
import { todayAtGym, type IsoDate } from "@/lib/dates";
import { activeFreeze, feeOn } from "@/members/billing";
import type { ReminderCandidate } from "@/notifications/candidates";
import { staffWhatsAppLink } from "@/notifications/channels/whatsapp";
import type {
  LogEntry,
  QueueItem,
  ReminderQueue,
} from "@/notifications/queries";
import { reminderFor, type ReminderStage } from "@/notifications/schedule";
import { dataOf } from "./action";
import { allRows, date, table } from "./db";
import { loadFactsAndLedgers, type MembershipRow } from "./ledgers";

export type { LogEntry, QueueItem, ReminderQueue };

/** Same rules as mayRemind in src/notifications/candidates.ts. */
function mayRemind(candidate: ReminderCandidate): boolean {
  return (
    candidate.consented &&
    !candidate.muted &&
    !candidate.frozen &&
    !candidate.free
  );
}

async function loadReminderCandidates(
  today: IsoDate,
): Promise<ReminderCandidate[]> {
  const rows = (await allRows(() =>
    table("memberships")
      .select(
        "id, memberId:member_id, startsOn:starts_on, billingStartsOn:billing_starts_on, dueChanges:due_changes, endedOn:ended_on, planId:plan_id, members!inner(member_code, full_name, phone, profile_id, is_active, reminder_consent_at, reminders_muted, profiles!members_profile_id_fkey(is_active, email))",
      )
      .is("ended_on", null)
      .eq("members.is_active", true)
      .order("id"),
  )) as (MembershipRow & {
    members: {
      member_code: string;
      full_name: string;
      phone: string;
      profile_id: string | null;
      reminder_consent_at: string | null;
      reminders_muted: boolean;
      profiles: { is_active: boolean; email: string | null } | null;
    };
  })[];

  const { facts, ledgers } = await loadFactsAndLedgers(rows, true, today, {
    scope: "all",
    coverage: false,
  });

  return rows
    .sort((a, b) => a.members.full_name.localeCompare(b.members.full_name))
    .flatMap((row) => {
      const fact = facts.get(row.id);
      const ledger = ledgers.get(row.id);
      if (!fact?.fees || !ledger) return [];
      const m = row.members;
      const accountActive =
        m.profile_id !== null && m.profiles?.is_active === true;
      return [
        {
          memberId: row.memberId,
          memberCode: m.member_code,
          fullName: m.full_name,
          phone: m.phone,
          profileId: accountActive ? m.profile_id : null,
          email: accountActive ? (m.profiles?.email ?? null) : null,
          consented: m.reminder_consent_at !== null,
          muted: m.reminders_muted,
          frozen: activeFreeze(fact.freezes, today) !== null,
          free: feeOn(fact.fees, today) === 0,
          membershipId: row.id,
          ledger,
        },
      ];
    });
}

export async function getReminderQueue(): Promise<ReminderQueue> {
  const today = todayAtGym();
  const candidates = await loadReminderCandidates(today);

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

  const ids = due.map(({ candidate }) => candidate.membershipId);
  const log = ids.length
    ? (
        dataOf(
          await table("notifications")
            .select(
              "membershipId:membership_id, period, channel, stage, status, at:created_at",
            )
            .in("membership_id", ids)
            .order("created_at", { ascending: false }),
        ) as {
          membershipId: string;
          period: number;
          channel: QueueItem["sent"][number]["channel"];
          stage: ReminderStage;
          status: QueueItem["sent"][number]["status"];
          at: string;
        }[]
      ).map((row) => ({ ...row, at: date(row.at) }))
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
}

export async function listNotificationLog(limit = 100): Promise<LogEntry[]> {
  const rows = dataOf(
    await table("notifications")
      .select(
        "id, at:created_at, memberId:member_id, channel, stage, status, dueOn:due_on, amountPaise:amount_paise, error, members(member_code, full_name), profiles(full_name)",
      )
      .order("created_at", { ascending: false })
      .limit(limit),
  ) as (Omit<LogEntry, "at" | "memberCode" | "fullName" | "sentBy"> & {
    at: string;
    members: { member_code: string; full_name: string };
    profiles: { full_name: string } | null;
  })[];
  return rows.map(({ members, profiles, at, ...row }) => ({
    ...row,
    at: date(at),
    memberCode: members.member_code,
    fullName: members.full_name,
    sentBy: profiles?.full_name ?? null,
  }));
}
