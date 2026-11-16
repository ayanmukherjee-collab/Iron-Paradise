// The words of every reminder, on every channel, in one place so push,
// email and WhatsApp all say the same thing.
import { formatDate, type IsoDate } from "@/lib/dates";
import { formatPaise } from "@/lib/money";
import type { DueReminder, ReminderStage } from "@/notifications/schedule";

const gymName = "Iron Paradise";

export const stageLabels: Record<ReminderStage, string> = {
  due_soon: "Due soon",
  due_today: "Due today",
  overdue: "Overdue",
};

export interface ReminderMessage {
  /** A short headline: push title, email subject. */
  title: string;
  /** One or two sentences, no greeting. */
  body: string;
}

function amountLine(reminder: DueReminder, today: IsoDate): string {
  const amount = formatPaise(reminder.amountPaise);
  const overdueSince =
    reminder.unpaidSince < today ? formatDate(reminder.unpaidSince) : null;

  switch (reminder.stage) {
    case "due_soon":
      return overdueSince
        ? `${amount} is due by ${formatDate(reminder.dueOn)}, including fees unpaid since ${overdueSince}.`
        : `Your fee of ${amount} is due on ${formatDate(reminder.dueOn)}.`;
    case "due_today":
      return overdueSince
        ? `${amount} is due today, including fees unpaid since ${overdueSince}.`
        : `Your fee of ${amount} is due today.`;
    case "overdue":
      return `${amount} has been due since ${formatDate(reminder.unpaidSince)}.`;
  }
}

const titles: Record<ReminderStage, string> = {
  due_soon: "Gym fee due soon",
  due_today: "Gym fee due today",
  overdue: "Gym fee overdue",
};

export function reminderMessage(
  reminder: DueReminder,
  today: IsoDate,
): ReminderMessage {
  return {
    title: titles[reminder.stage],
    body: `${amountLine(reminder, today)} Please pay at the front desk.`,
  };
}

export function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? fullName;
}

/** The text staff send on WhatsApp, ready to go. */
export function whatsAppText(input: {
  fullName: string;
  memberCode: string;
  reminder: DueReminder;
  today: IsoDate;
}): string {
  const { body } = reminderMessage(input.reminder, input.today);
  return [
    `Hi ${firstName(input.fullName)}, this is ${gymName}.`,
    body,
    `Member ID: ${input.memberCode}. Thank you!`,
  ].join(" ");
}

/** Subject and plain-text body for the reminder email. */
export function emailText(input: {
  fullName: string;
  memberCode: string;
  reminder: DueReminder;
  today: IsoDate;
  appUrl: string;
}): { subject: string; text: string } {
  const message = reminderMessage(input.reminder, input.today);
  return {
    subject: `${message.title} · ${gymName}`,
    text: [
      `Hi ${firstName(input.fullName)},`,
      "",
      message.body,
      "",
      `Member ID: ${input.memberCode}`,
      `See your payments: ${input.appUrl}`,
      "",
      `${gymName}`,
      "",
      "You get these because you agreed to fee reminders when you joined. Ask at the front desk to stop them.",
    ].join("\n"),
  };
}

/** "₹600 · due 18 Nov 2026" or "₹1,200 · overdue since 12 Oct 2026". */
export function reminderSummary(reminder: DueReminder): string {
  const amount = formatPaise(reminder.amountPaise);
  switch (reminder.stage) {
    case "due_soon":
      return `${amount} · due ${formatDate(reminder.dueOn)}`;
    case "due_today":
      return `${amount} · due today`;
    case "overdue":
      return `${amount} · overdue since ${formatDate(reminder.unpaidSince)}`;
  }
}

export const channelLabels = {
  push: "Push",
  email: "Email",
  whatsapp: "WhatsApp",
} as const;

export const statusLabels = {
  sending: "Sending",
  sent: "Sent",
  failed: "Failed",
} as const;
