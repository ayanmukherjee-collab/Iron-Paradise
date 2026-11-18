// Mirrors src/app/app/reminders/page.tsx. Every row is the same shape: a
// name on one line, one short muted line under it, and one control on the
// right, so long names or amounts never push a row onto a third line.
import { useEffect, useRef, useState } from "react";
import Link from "@/components/ui/link";
import { NavIconSvg } from "@/components/nav/nav-icons";
import { iconButton } from "@/components/ui/viz";
import { formatDateTime, formatShortDate, type IsoDate } from "@/lib/dates";
import { formatPaise } from "@/lib/money";
import { OverdueQueue } from "@/notifications/components/overdue-queue";
import { WhatsAppButton } from "@/notifications/components/whatsapp-button";
import {
  channelLabels,
  reminderSummary,
  stageLabels,
  statusLabels,
} from "@/notifications/message";
import type { DueReminder, ReminderStage } from "@/notifications/schedule";
import {
  getReminderQueue,
  listNotificationLog,
  type LogEntry,
  type QueueItem,
  type ReminderQueue,
} from "../data/reminders";
import { refreshData } from "../data/refresh";
import { Loaded, useLoad, useTitle } from "../data/use-load";
import { sendRemindersNow } from "../actions/notifications";
import { env } from "../lib/env";

export function RemindersPage() {
  useTitle("Reminders");
  const state = useLoad(
    async () => {
      const [queue, log] = await Promise.all([
        getReminderQueue(),
        listNotificationLog(),
      ]);
      return { queue, log };
    },
    [],
    "reminders",
  );
  return <Loaded state={state}>{(data) => <RemindersView {...data} />}</Loaded>;
}

/** How many sent entries show before "See all". */
const logPreview = 8;

function RemindersView({
  queue,
  log,
}: {
  queue: ReminderQueue;
  log: LogEntry[];
}) {
  const [allLog, setAllLog] = useState(false);
  // Which automatic channels the reminder job has keys for (set at build
  // time from the same settings the Edge Function uses).
  const automatic = [
    { label: "Push", on: !!env.vapidPublicKey },
    { label: "Email", on: !!env.emailReminders },
  ];
  const overdueToSend = queue.items.filter(
    (item) => item.reminder.stage === "overdue" && !item.whatsAppSentAt,
  );
  const heldBack = queue.heldBack.noConsent + queue.heldBack.muted;
  const shownLog = allLog ? log : log.slice(0, logPreview);

  return (
    <div className="space-y-6">
      <header className="page-header">
        <div className="flex items-center justify-between gap-3">
          <h1 className="page-title">Reminders</h1>
          <SendAllBell
            count={queue.items.length}
            canSend={automatic.some(({ on }) => on)}
          />
        </div>
        <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
          <span>Automatic:</span>
          {automatic.map(({ label, on }) => (
            <span key={label} className="inline-flex items-center gap-1.5">
              <span
                aria-hidden="true"
                className={`size-1.5 rounded-full ${on ? "bg-ink" : "bg-ink/20"}`}
              />
              {label} {on ? "on" : "off"}
            </span>
          ))}
        </p>
      </header>

      <section className="space-y-3">
        <SectionHeading title="To remind" count={queue.items.length} />
        <OverdueQueue
          entries={overdueToSend.map((item) => ({
            membershipId: item.membershipId,
            fullName: item.fullName,
            memberCode: item.memberCode,
            summary: reminderSummary(item.reminder),
            whatsAppLink: item.whatsAppLink,
          }))}
        />
        {queue.items.length === 0 ? (
          <p className="rounded-card bg-white p-6 text-center text-muted shadow-card">
            All clear
          </p>
        ) : (
          <ul className="list-card">
            {queue.items.map((item) => (
              <QueueRow
                key={item.membershipId}
                item={item}
                today={queue.today}
              />
            ))}
          </ul>
        )}
        {heldBack > 0 && (
          <p className="px-1 text-sm text-muted">
            +{heldBack} not shown:{" "}
            {[
              queue.heldBack.noConsent > 0 &&
                `${queue.heldBack.noConsent} without consent`,
              queue.heldBack.muted > 0 && `${queue.heldBack.muted} muted`,
            ]
              .filter(Boolean)
              .join(", ")}
          </p>
        )}
      </section>

      <section className="space-y-3">
        <SectionHeading title="Sent" count={log.length}>
          {log.length > logPreview && (
            <button
              type="button"
              onClick={() => setAllLog((value) => !value)}
              className="min-h-10 text-sm font-medium text-muted underline decoration-line underline-offset-4 hover:text-ink hover:decoration-ink"
            >
              {allLog ? "Show fewer" : `See all ${log.length}`}
            </button>
          )}
        </SectionHeading>
        {log.length === 0 ? (
          <p className="rounded-card bg-white p-6 text-center text-muted shadow-card">
            Nothing yet
          </p>
        ) : (
          <ol className="list-card">
            {shownLog.map((entry) => (
              <LogRow key={entry.id} entry={entry} />
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}

type BellState =
  | { step: "closed" }
  | { step: "confirm" }
  | { step: "sending" }
  | { step: "done"; ok: boolean; message: string };

/**
 * The bell: sends push and email now to everyone listed under "To remind".
 * One tap opens a small confirm under it; the answer replaces the confirm.
 * The job never sends the same reminder twice, so a second press only
 * reaches members added since.
 */
function SendAllBell({ count, canSend }: { count: number; canSend: boolean }) {
  const [state, setState] = useState<BellState>({ step: "closed" });
  const wrapper = useRef<HTMLDivElement>(null);
  const open = state.step !== "closed";

  useEffect(() => {
    if (!open || state.step === "sending") return;
    const close = (event: Event) => {
      if (
        event instanceof KeyboardEvent
          ? event.key === "Escape"
          : !wrapper.current?.contains(event.target as Node)
      ) {
        setState({ step: "closed" });
      }
    };
    document.addEventListener("keydown", close);
    document.addEventListener("pointerdown", close);
    return () => {
      document.removeEventListener("keydown", close);
      document.removeEventListener("pointerdown", close);
    };
  }, [open, state.step]);

  const disabled = !canSend || count === 0;
  const title = !canSend
    ? "Push and email aren't set up"
    : count === 0
      ? "No one to remind"
      : "Remind everyone by push and email";

  async function send() {
    setState({ step: "sending" });
    const result = await sendRemindersNow({});
    setState(
      result.ok
        ? { step: "done", ok: true, message: result.data.message }
        : { step: "done", ok: false, message: result.error },
    );
    if (result.ok) refreshData();
  }

  return (
    <div ref={wrapper} className="relative">
      <button
        type="button"
        disabled={disabled}
        aria-label={title}
        title={title}
        aria-expanded={open}
        onClick={() =>
          setState(open ? { step: "closed" } : { step: "confirm" })
        }
        className={`${iconButton} bg-ink text-white hover:bg-graphite disabled:bg-ink/20 disabled:active:scale-100`}
      >
        <NavIconSvg
          icon="reminders"
          className={`size-5 ${state.step === "sending" ? "motion-safe:animate-pulse" : ""}`}
        />
      </button>
      {open && (
        <div
          role={state.step === "done" ? "status" : "dialog"}
          aria-label="Send reminders"
          className="absolute top-full right-0 z-20 mt-2 w-72 rounded-card bg-white p-4 text-sm shadow-card ring-1 ring-line"
        >
          {state.step === "done" ? (
            <>
              <p className={state.ok ? "text-ink" : "font-medium text-ink"}>
                {state.message}
              </p>
              <button
                type="button"
                onClick={() => setState({ step: "closed" })}
                className="mt-3 min-h-10 font-medium text-muted underline decoration-line underline-offset-4 hover:text-ink hover:decoration-ink"
              >
                Close
              </button>
            </>
          ) : (
            <>
              <p className="font-semibold">
                Remind {count === 1 ? "1 member" : `all ${count}`}?
              </p>
              <p className="mt-1 text-muted">
                Sends the app notification and email to everyone under To
                remind. Nobody gets the same reminder twice.
              </p>
              <div className="mt-3 flex justify-end gap-2">
                <button
                  type="button"
                  disabled={state.step === "sending"}
                  onClick={() => setState({ step: "closed" })}
                  className="min-h-10 rounded-control px-3 font-medium text-muted hover:text-ink"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={state.step === "sending"}
                  onClick={send}
                  className="min-h-10 rounded-control bg-ink px-4 font-semibold text-white hover:bg-graphite disabled:bg-ink/60"
                >
                  {state.step === "sending" ? "Sending…" : "Send"}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function SectionHeading({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex min-h-10 items-center justify-between gap-3 px-1">
      <h2 className="flex items-center gap-2 section-title">
        {title}
        <span className="rounded-badge bg-white px-2 py-0.5 text-sm font-medium text-muted tabular-nums ring-1 ring-line">
          {count}
        </span>
      </h2>
      {children}
    </div>
  );
}

const stageDots: Record<ReminderStage, string> = {
  overdue: "bg-ink",
  due_today: "bg-ink/40",
  due_soon: "ring-2 ring-inset ring-ink/30",
};

/** "₹600 · since 2 Nov", "₹600 · today", "₹600 · 21 Nov". */
function shortSummary(reminder: DueReminder, today: IsoDate): string {
  const amount = formatPaise(reminder.amountPaise);
  switch (reminder.stage) {
    case "overdue":
      return `${amount} · since ${formatShortDate(reminder.unpaidSince, today)}`;
    case "due_today":
      return `${amount} · today`;
    case "due_soon":
      return `${amount} · ${formatShortDate(reminder.dueOn, today)}`;
  }
}

function QueueRow({ item, today }: { item: QueueItem; today: IsoDate }) {
  const automatic = item.sent.filter((sent) => sent.channel !== "whatsapp");
  const autoNote = automatic[0]
    ? `${channelLabels[automatic[0].channel]} ${statusLabels[automatic[0].status].toLowerCase()}`
    : null;
  return (
    <li className="flex min-h-[4.5rem] items-center gap-3 list-row py-3">
      <span
        aria-hidden="true"
        className={`size-2.5 shrink-0 rounded-full ${stageDots[item.reminder.stage]}`}
      />
      <div className="min-w-0 flex-1">
        <Link
          href={`/app/members/${item.memberId}`}
          className="block truncate font-semibold hover:underline hover:underline-offset-4"
        >
          {item.fullName}
        </Link>
        <p
          className="truncate text-sm text-muted"
          title={reminderSummary(item.reminder)}
        >
          <strong className="font-medium text-ink">
            {stageLabels[item.reminder.stage]}
          </strong>{" "}
          · {shortSummary(item.reminder, today)}
          {autoNote && ` · ${autoNote}`}
        </p>
      </div>
      {item.whatsAppSentAt ? (
        <span
          title={`WhatsApp sent ${formatDateTime(item.whatsAppSentAt)}`}
          className="flex h-11 shrink-0 items-center gap-1 rounded-control bg-canvas px-3 text-xs font-medium text-muted"
        >
          <NavIconSvg icon="check" className="size-4" />
          Sent
        </span>
      ) : (
        <WhatsAppButton
          href={item.whatsAppLink}
          membershipId={item.membershipId}
          label={`WhatsApp ${item.fullName}`}
          compact
        />
      )}
    </li>
  );
}

function LogRow({ entry }: { entry: LogEntry }) {
  const detail = [
    channelLabels[entry.channel],
    statusLabels[entry.status],
    formatDateTime(entry.at),
    entry.sentBy ?? "Auto",
    entry.error,
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <li className="flex min-h-[4.5rem] items-center gap-3 list-row py-3">
      <div className="min-w-0 flex-1">
        <Link
          href={`/app/members/${entry.memberId}`}
          className="block truncate font-semibold hover:underline hover:underline-offset-4"
        >
          {entry.fullName}
        </Link>
        <p className="truncate text-sm text-muted" title={detail}>
          {entry.status === "failed" ? (
            <strong className="font-medium text-ink">{detail}</strong>
          ) : (
            detail
          )}
        </p>
      </div>
      <span className="shrink-0 text-sm font-semibold tabular-nums">
        {formatPaise(entry.amountPaise)}
      </span>
    </li>
  );
}
