// Mirrors src/app/app/reminders/page.tsx.
import Link from "@/components/ui/link";
import { NavIconSvg } from "@/components/nav/nav-icons";
import { formatDate, formatDateTime } from "@/lib/dates";
import { formatPaise } from "@/lib/money";
import { OverdueQueue } from "@/notifications/components/overdue-queue";
import { WhatsAppButton } from "@/notifications/components/whatsapp-button";
import {
  channelLabels,
  reminderSummary,
  stageLabels,
  statusLabels,
} from "@/notifications/message";
import type { ReminderStage } from "@/notifications/schedule";
import {
  getReminderQueue,
  listNotificationLog,
  type LogEntry,
  type QueueItem,
  type ReminderQueue,
} from "../data/reminders";
import { Loaded, useLoad, useTitle } from "../data/use-load";
import { env } from "../lib/env";

export function RemindersPage() {
  useTitle("Reminders");
  const state = useLoad(async () => {
    const [queue, log] = await Promise.all([
      getReminderQueue(),
      listNotificationLog(),
    ]);
    return { queue, log };
  }, []);
  return <Loaded state={state}>{(data) => <RemindersView {...data} />}</Loaded>;
}

function RemindersView({
  queue,
  log,
}: {
  queue: ReminderQueue;
  log: LogEntry[];
}) {
  // Which automatic channels the reminder job has keys for (set at build
  // time from the same settings the Edge Function uses).
  const automatic = new Set([
    ...(env.vapidPublicKey ? ["push"] : []),
    ...(env.emailReminders ? ["email"] : []),
  ]);
  const overdueToSend = queue.items.filter(
    (item) => item.reminder.stage === "overdue" && !item.whatsAppSentAt,
  );
  const heldBack = queue.heldBack.noConsent + queue.heldBack.muted;

  return (
    <div className="space-y-5">
      <header className="page-header flex flex-wrap items-center justify-between gap-3">
        <h1 className="page-title">Reminders</h1>
        <ul className="flex gap-2" aria-label="Automatic reminders">
          {(
            [
              ["push", "reminders", "Push"],
              ["email", "mail", "Email"],
            ] as const
          ).map(([channel, icon, label]) => {
            const on = automatic.has(channel);
            return (
              <li
                key={channel}
                title={`Automatic ${label.toLowerCase()} ${on ? "on" : "not set up"}`}
                className={`inline-flex items-center gap-1.5 rounded-control px-3 py-2 text-xs font-medium ${on ? "bg-ink text-white" : "bg-white text-muted ring-1 ring-line"}`}
              >
                <NavIconSvg icon={icon} className="size-4" />
                {label}
                <span
                  className={`size-1.5 rounded-full ${on ? "bg-white" : "bg-ink/25"}`}
                />
                <span className="sr-only">{on ? "on" : "off"}</span>
              </li>
            );
          })}
        </ul>
      </header>

      <section className="card-section">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h2 className="flex items-center gap-2 section-title">
            To remind
            <span className="rounded-badge bg-canvas px-2 py-0.5 text-sm tabular-nums">
              {queue.items.length}
            </span>
          </h2>
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
          <p className="mt-6 text-center text-muted">All clear</p>
        ) : (
          <ul className="mt-6 list-card">
            {queue.items.map((item) => (
              <QueueRow key={item.membershipId} item={item} />
            ))}
          </ul>
        )}
        {heldBack > 0 && (
          <p className="mt-4 text-sm text-muted">
            +{heldBack} hidden ·{" "}
            {[
              queue.heldBack.noConsent > 0 &&
                `${queue.heldBack.noConsent} no consent`,
              queue.heldBack.muted > 0 && `${queue.heldBack.muted} muted`,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        )}
      </section>

      <section className="card-section">
        <h2 className="section-title">Sent</h2>
        {log.length === 0 ? (
          <p className="mt-4 text-center text-muted">Nothing yet</p>
        ) : (
          <ol className="mt-6 list-card">
            {log.map((entry) => (
              <li key={entry.id} className="list-row py-3">
                <p>
                  <Link
                    href={`/app/members/${entry.memberId}`}
                    className="font-semibold underline decoration-line underline-offset-4 hover:decoration-ink"
                  >
                    {entry.fullName}
                  </Link>{" "}
                  <span className="font-mono text-sm">{entry.memberCode}</span>{" "}
                  · {channelLabels[entry.channel]} ·{" "}
                  {formatPaise(entry.amountPaise)} · {formatDate(entry.dueOn)}
                </p>
                <p className="text-sm text-muted">
                  <strong className="text-ink">
                    {statusLabels[entry.status]}
                  </strong>{" "}
                  · {formatDateTime(entry.at)} · {entry.sentBy ?? "Auto"}
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
  due_today: "bg-ink/10 text-ink",
  due_soon: "bg-white text-ink ring-1 ring-inset ring-ink/20",
};

function QueueRow({ item }: { item: QueueItem }) {
  const automatic = item.sent.filter((sent) => sent.channel !== "whatsapp");
  return (
    <li className="flex flex-wrap items-center justify-between gap-4 list-row py-4">
      <div>
        <p className="flex flex-wrap items-center gap-2">
          <Link
            href={`/app/members/${item.memberId}`}
            className="text-lg font-semibold underline decoration-line underline-offset-4 hover:decoration-ink"
          >
            {item.fullName}
          </Link>
          <span className="font-mono text-sm">{item.memberCode}</span>
          <span
            className={`rounded-badge px-2 py-1 text-xs font-medium ${stageStyles[item.reminder.stage]}`}
          >
            {stageLabels[item.reminder.stage]}
          </span>
        </p>
        <p className="mt-1">{reminderSummary(item.reminder)}</p>
        {automatic.length > 0 && (
          <p className="text-sm text-muted">
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
        <p className="text-sm text-muted">
          <NavIconSvg icon="check" className="mr-1 inline size-4" />
          {formatDateTime(item.whatsAppSentAt)}
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
