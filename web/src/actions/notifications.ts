// Browser versions of src/notifications/actions.ts.
import { z } from "zod";
import { todayAtGym } from "@/lib/dates";
import { activeFreeze, feeOn } from "@/members/billing";
import { reminderFor } from "@/notifications/schedule";
import { pushEndpoint, pushSubscription } from "@/notifications/schemas";
import { dataOf, Refusal } from "../data/action";
import { rpc, supabase, table } from "../data/db";
import { ledgerFor } from "../data/due-dates";
import { guardedAction } from "../data/guarded";
import { loadFacts, membershipRow } from "../data/ledgers";

/**
 * Records that a staff member opened WhatsApp to remind a member; the page
 * opens WhatsApp itself. What is owed is worked out again here.
 */
export const logWhatsAppReminder = guardedAction({
  permission: "reminders.send",
  input: z.object({ membershipId: z.uuid() }),
  run: async ({ membershipId }, viewer) => {
    const today = todayAtGym();
    const row = await membershipRow(membershipId);
    if (!row || row.endedOn)
      throw new Refusal("This member isn't active any more.");
    const [member, facts, { ledger, memberId }] = await Promise.all([
      table("members")
        .select("is_active, reminder_consent_at, reminders_muted")
        .eq("id", row.memberId)
        .maybeSingle()
        .then(
          dataOf<{
            is_active: boolean;
            reminder_consent_at: string | null;
            reminders_muted: boolean;
          } | null>,
        ),
      loadFacts([row], true).then((map) => map.get(row.id) ?? null),
      ledgerFor(membershipId, today),
    ]);
    if (!member?.is_active || !facts?.fees) {
      throw new Refusal("This member isn't active any more.");
    }
    if (!member.reminder_consent_at || member.reminders_muted) {
      throw new Refusal(
        "This member hasn't agreed to reminders, or they are muted.",
      );
    }
    if (activeFreeze(facts.freezes, today) || feeOn(facts.fees, today) === 0) {
      throw new Refusal("Frozen and free members get no reminders.");
    }
    const reminder = reminderFor(ledger, today, "staff");
    if (!reminder) throw new Refusal("Nothing is due for this member now.");

    const { error } = await table("notifications").insert({
      member_id: memberId,
      membership_id: membershipId,
      period: reminder.period,
      stage: reminder.stage,
      channel: "whatsapp",
      status: "sent",
      due_on: reminder.dueOn,
      amount_paise: reminder.amountPaise,
      sent_by: viewer.userId,
      finished_at: new Date().toISOString(),
    });
    if (error?.code === "23505")
      return { message: "Already logged for this due date." };
    dataOf({ data: null, error });
    return { message: "Logged as sent." };
  },
});

/**
 * The bell on the Reminders screen: sends push and email now to every
 * member the screen lists as due. Runs the same job as the daily run, in the
 * reminders Edge Function (it holds the push and email keys), so nobody gets
 * the same reminder twice however often it is pressed.
 */
export const sendRemindersNow = guardedAction({
  permission: "reminders.send",
  input: z.object({}),
  run: async () => {
    const { data, error } = await supabase.functions.invoke<{
      ok: boolean;
      message: string;
    }>("reminders", { method: "POST" });
    if (error || !data) {
      throw new Refusal(
        "Couldn't send reminders right now. Try again in a few minutes.",
      );
    }
    if (!data.ok) throw new Refusal(data.message);
    return { message: data.message };
  },
});

export const savePushSubscription = guardedAction({
  permission: "self.view",
  input: pushSubscription,
  run: async ({ endpoint, p256dh, auth }) => {
    await rpc("save_push_subscription", {
      sub_endpoint: endpoint,
      sub_p256dh: p256dh,
      sub_auth: auth,
    });
    return { message: "Notifications are on for this phone." };
  },
});

export const removePushSubscription = guardedAction({
  permission: "self.view",
  input: z.object({ endpoint: pushEndpoint }),
  run: async ({ endpoint }) => {
    // RLS limits the delete to the caller's own subscriptions.
    dataOf(await table("push_subscriptions").delete().eq("endpoint", endpoint));
    return { message: "Notifications are off for this phone." };
  },
});

/**
 * Sends a test notification to the signed-in person's own phones. Signing
 * the push needs the private VAPID key, so this runs in the send-test-push
 * Supabase Edge Function (supabase/functions/send-test-push).
 */
export const sendTestNotification = guardedAction({
  permission: "self.view",
  input: z.object({}),
  run: async () => {
    const { data, error } = await supabase.functions.invoke<{
      ok: boolean;
      message: string;
    }>("send-test-push", { method: "POST" });
    if (error || !data) {
      throw new Refusal(
        "Couldn't send a test right now. Try again in a few minutes.",
      );
    }
    if (!data.ok) throw new Refusal(data.message);
    return { message: data.message };
  },
});
