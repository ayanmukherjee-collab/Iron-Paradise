import type { Metadata } from "next";
import Link from "next/link";
import { requirePermission } from "@/auth/session";
import { formatDate, formatDateTime } from "@/lib/dates";
import { formatPaise } from "@/lib/money";
import { configuredChannels } from "@/notifications/channels";
import { OverdueQueue } from "@/notifications/components/overdue-queue";
import { WhatsAppButton } from "@/notifications/components/whatsapp-button";
import {
  channelLabels,
  reminderSummary,
  stageLabels,
  statusLabels,
} from "@/notifications/message";
import {
  getReminderQueue,
  listNotificationLog,
  type QueueItem,
} from "@/notifications/queries";
import type { ReminderStage } from "@/notifications/schedule";

export const metadata: Metadata = { title: "Reminders" };

export default async function RemindersPage() {
  const viewer = await requirePermission("reminders.send", "/app/reminders");
  const [queue, log] = await Promise.all([
    getReminderQueue(viewer),
    listNotificationLog(viewer),
  ]);
  const automatic = new Set(
    configuredChannels().map((channel) => channel.name),
  );
  const overdueToSend = queue.items.filter(
    (item) => item.reminder.stage === "overdue" && !item.whatsAppSentAt,
  );
  const heldBack = queue.heldBack.noConsent + queue.heldBack.muted;

  return (
    <div className="space-y-12">
      <section>
        <h1 className="display text-5xl">Reminders</h1>
        <p className="mt-3 max-w-prose text-lg">
          Every morning the app reminds members by itself: 3 days before a fee
          is due, on the day, and 3 days after. WhatsApp messages you send from
          here. A payment stops the next reminder.
        </p>
        <p className="mt-4 text-sm text-smoke">
          Automatic push: {automatic.has("push") ? "on" : "not set up"} ·
          Automatic email: {automatic.has("email") ? "on" : "not set up"}
        </p>
      </section>

      <section className="border-t-2 border-ink pt-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h2 className="display text-3xl">To remind · {queue.items.length}</h2>
          <OverdueQueue
            entries={overdueToSend.map((item) => ({
              membershipId: item.membershipId,
              fullName: item.fullName,
              memberCode: item.memberCode,
              summary: reminderSummary(item.reminder),
              whatsAppLink: item.whatsAppLink,
            }))}
          />
        </div>
        {queue.items.length === 0 ? (
          <p className="mt-6 text-lg">Nobody is due in the next 3 days.</p>
        ) : (
          <ul className="mt-6 border-t-2 border-ink">
            {queue.items.map((item) => (
              <QueueRow key={item.membershipId} item={item} />
            ))}
          </ul>
        )}
        {heldBack > 0 && (
          <p className="mt-4 max-w-prose text-smoke">
            {heldBack === 1 ? "1 member owes" : `${heldBack} members owe`} but
            {heldBack === 1 ? " is" : " are"} not listed:{" "}
            {[
              queue.heldBack.noConsent > 0 &&
                `${queue.heldBack.noConsent} never agreed to reminders`,
              queue.heldBack.muted > 0 && `${queue.heldBack.muted} muted`,
            ]
              .filter(Boolean)
              .join(", ")}
            . Change this on their member page.
          </p>
        )}
      </section>

      <section className="border-t-2 border-ink pt-6">
        <h2 className="display text-3xl">Sent messages</h2>
        {log.length === 0 ? (
          <p className="mt-4 text-lg">No reminders sent yet.</p>
        ) : (
          <ol className="mt-6 border-t-2 border-ink">
            {log.map((entry) => (
              <li key={entry.id} className="border-b-2 border-ink py-3">
                <p>
                  <Link
                    href={`/app/members/${entry.memberId}`}
                    className="font-semibold underline underline-offset-4"
                  >
                    {entry.fullName}
                  </Link>{" "}
                  <span className="font-mono text-sm">{entry.memberCode}</span>{" "}
                  · {channelLabels[entry.channel]} · {stageLabels[entry.stage]}{" "}
                  · {formatPaise(entry.amountPaise)} due{" "}
                  {formatDate(entry.dueOn)}
                </p>
                <p className="text-sm text-smoke">
                  <strong className="text-ink">
                    {statusLabels[entry.status]}
                  </strong>{" "}
                  · {formatDateTime(entry.at)} ·{" "}
                  {entry.sentBy ? `by ${entry.sentBy}` : "daily job"}
                  {entry.error && ` · ${entry.error}`}
                </p>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}

const stageStyles: Record<ReminderStage, string> = {
  overdue: "bg-ink text-white",
  due_today: "bg-ash text-white",
  due_soon: "border-2 border-ink text-ink",
};

function QueueRow({ item }: { item: QueueItem }) {
  const automatic = item.sent.filter((sent) => sent.channel !== "whatsapp");
  return (
    <li className="flex flex-wrap items-center justify-between gap-4 border-b-2 border-ink py-4">
      <div>
        <p className="flex flex-wrap items-center gap-2">
          <Link
            href={`/app/members/${item.memberId}`}
            className="text-lg font-semibold underline underline-offset-4"
          >
            {item.fullName}
          </Link>
          <span className="font-mono text-sm">{item.memberCode}</span>
          <span
            className={`px-2 py-0.5 text-xs font-bold tracking-[0.08em] uppercase ${stageStyles[item.reminder.stage]}`}
          >
            {stageLabels[item.reminder.stage]}
          </span>
        </p>
        <p className="mt-1">{reminderSummary(item.reminder)}</p>
        {automatic.length > 0 && (
          <p className="text-sm text-smoke">
            {automatic
              .map(
                (sent) =>
                  `${channelLabels[sent.channel]} ${statusLabels[sent.status].toLowerCase()} ${formatDateTime(sent.at)}`,
              )
              .join(" · ")}
          </p>
        )}
      </div>
      {item.whatsAppSentAt ? (
        <p className="text-sm text-smoke">
          WhatsApp sent {formatDateTime(item.whatsAppSentAt)}
        </p>
      ) : (
        <WhatsAppButton
          href={item.whatsAppLink}
          membershipId={item.membershipId}
        />
      )}
    </li>
  );
}
