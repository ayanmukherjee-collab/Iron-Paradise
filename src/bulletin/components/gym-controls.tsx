// The owner's and managers' Home controls: shut today's batches, and post
// notices to members. Icons and shapes only, like the rest of Home; every
// control has an accessible name and a hover title that says what it does.
import type { ReactNode } from "react";
import { batchHours } from "@/attendance/batches";
import { NavIconSvg, type NavIcon } from "@/components/nav/nav-icons";
import { ActionForm } from "@/components/ui/action-form";
import { inputBase } from "@/components/ui/field";
import { formatShortDate, todayAtGym } from "@/lib/dates";
import {
  deleteAnnouncement,
  pinAnnouncement,
  saveAnnouncement,
  toggleClosedToday,
} from "@/bulletin/actions";
import { closedBatches, splitBatches, type Batch } from "@/bulletin/hours";
import type { AnnouncementRow, TodayControls } from "@/bulletin/queries";
import { IconAction } from "@/bulletin/components/icon-action";

const tile =
  "relative flex aspect-square w-full flex-col items-center justify-center gap-2 rounded-tile ring-1 transition-[background-color,color,transform] duration-150 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-35";
const tileOpen = "bg-white text-ink ring-line hover:bg-canvas";
const tileShut = "bg-ink text-white ring-ink hover:bg-graphite";

/** Today's close tiles: whole day, morning batch, evening batch. */
export function CloseToday({
  controls,
  className = "",
}: {
  controls: TodayControls;
  className?: string;
}) {
  const usual = splitBatches(controls.usual);
  const shut = closedBatches(controls.usual, controls.closure);
  const runsToday = controls.usual.length > 0;
  const dayShut =
    runsToday &&
    (!usual.morning || shut.morning) &&
    (!usual.evening || shut.evening);

  const batchTile = (batch: Batch, icon: NavIcon, name: string) => (
    <IconAction
      action={toggleClosedToday}
      fields={{ part: batch }}
      icon={icon}
      label={
        shut[batch]
          ? `Reopen the ${name} batch today`
          : `Close the ${name} batch today`
      }
      pressed={shut[batch]}
      disabled={!usual[batch]}
      className={`${tile} ${shut[batch] ? tileShut : tileOpen}`}
    >
      {shut[batch] && <Strike />}
      <span className="text-xs tabular-nums opacity-70">
        {batchHours(usual, batch)}
      </span>
    </IconAction>
  );

  // What's shut today, shown on the closed dropdown so it reads at a glance.
  const shutIcons: NavIcon[] = dayShut
    ? ["power"]
    : [
        ...(shut.morning ? (["sun"] as const) : []),
        ...(shut.evening ? (["moon"] as const) : []),
      ];

  return (
    <Dropdown
      icon="power"
      label="Close the gym today"
      lit={shutIcons.length > 0}
      className={className}
      summary={shutIcons.map((icon) => (
        <span
          key={icon}
          className="relative flex size-7 items-center justify-center rounded-badge bg-ink text-white"
        >
          <NavIconSvg icon={icon} className="size-4" />
          <Strike />
        </span>
      ))}
    >
      <div className="grid grid-cols-3 gap-3">
        <IconAction
          action={toggleClosedToday}
          fields={{ part: "day" }}
          icon="power"
          label={
            dayShut ? "Reopen the gym today" : "Close the gym all day today"
          }
          pressed={dayShut}
          disabled={!runsToday}
          className={`${tile} ${dayShut ? tileShut : tileOpen}`}
        >
          {dayShut && <Strike />}
          <span aria-hidden="true" className="flex gap-1 opacity-70">
            <NavIconSvg icon="sun" className="size-3.5" />
            <NavIconSvg icon="moon" className="size-3.5" />
          </span>
        </IconAction>
        {batchTile("morning", "sun", "morning")}
        {batchTile("evening", "moon", "evening")}
      </div>
    </Dropdown>
  );
}

/** A diagonal bar across a shut tile, so "off" reads without colour. */
function Strike() {
  return (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute top-1/2 left-1/2 h-0.5 w-3/5 -translate-x-1/2 -translate-y-1/2 -rotate-45 rounded-full bg-current opacity-80"
    />
  );
}

/**
 * A Home card that folds away: one short row (its icon, a glance at the
 * current state, a chevron) that opens to the controls. Closed by default.
 * A save refreshes the page without closing it: React leaves the
 * uncontrolled `open` attribute alone.
 */
function Dropdown({
  icon,
  label,
  lit,
  summary,
  className = "",
  children,
}: {
  icon: NavIcon;
  /** The accessible name and hover title; never shown as text. */
  label: string;
  /** Darkens the icon when something is set (a batch shut, say). */
  lit?: boolean;
  summary?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <details className={`group self-start card ${className}`}>
      <summary
        title={label}
        className="flex min-h-16 cursor-pointer list-none items-center gap-3 rounded-card px-4 py-3 transition-colors hover:bg-canvas/50 sm:px-5 [&::-webkit-details-marker]:hidden"
      >
        <span
          className={`flex size-8 shrink-0 items-center justify-center rounded-control ${lit ? "bg-ink text-white" : "bg-canvas"}`}
        >
          <NavIconSvg icon={icon} className="size-4" />
        </span>
        <span className="sr-only">{label}</span>
        <span className="flex min-w-0 flex-1 items-center gap-2">
          {summary}
        </span>
        <NavIconSvg
          icon="chevronDown"
          className="size-5 shrink-0 text-muted transition-transform duration-200 group-open:rotate-180"
        />
      </summary>
      <div className="px-4 pt-1 pb-4 sm:px-5 sm:pb-5">{children}</div>
    </details>
  );
}

/** Post a notice, and the live ones with pin, edit and remove. */
export function Notices({
  controls,
  className = "",
}: {
  controls: TodayControls;
  className?: string;
}) {
  const live = controls.announcements.length;
  return (
    <Dropdown
      icon="megaphone"
      label="Notices for members"
      className={className}
      summary={
        live > 0 && (
          <span className="flex min-w-7 items-center justify-center rounded-badge bg-canvas px-2 py-1 text-xs font-semibold tabular-nums">
            {live}
            <span className="sr-only"> live notices</span>
          </span>
        )
      }
    >
      <NoticeForm today={controls.today} />

      {live > 0 && (
        <ul className="mt-5 divide-y divide-line border-t border-line">
          {controls.announcements.map((notice) => (
            <NoticeRow key={notice.id} notice={notice} today={controls.today} />
          ))}
        </ul>
      )}
    </Dropdown>
  );
}

const iconButton =
  "flex size-11 shrink-0 items-center justify-center rounded-control ring-1 ring-line bg-white text-ink transition-colors hover:bg-ink hover:text-white";

/** New notice, or an existing one when `notice` is given. */
function NoticeForm({
  today,
  notice,
}: {
  today: string;
  notice?: AnnouncementRow;
}) {
  const expiresOn = notice?.expiresAt ? todayAtGym(notice.expiresAt) : "";
  return (
    <ActionForm
      action={saveAnnouncement}
      submitLabel={notice ? "Save notice" : "Post notice"}
      icon="send"
      className="mt-4 space-y-3"
    >
      {notice && (
        <input type="hidden" name="announcementId" value={notice.id} />
      )}
      <input
        name="title"
        required
        maxLength={120}
        defaultValue={notice?.title}
        aria-label="Heading"
        title="Heading"
        className={`${inputBase} font-semibold`}
      />
      <textarea
        name="body"
        rows={3}
        maxLength={2000}
        defaultValue={notice?.body}
        aria-label="Notice"
        title="Notice"
        className={`${inputBase} py-3`}
      />
      <div className="flex items-center gap-3">
        <label
          title="Pin to the top"
          className="relative flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-control bg-white text-ink ring-1 ring-line transition-colors has-checked:bg-ink has-checked:text-white has-checked:ring-ink has-focus-visible:ring-4 has-focus-visible:ring-ink/10"
        >
          <input
            type="checkbox"
            name="pinned"
            defaultChecked={notice?.pinned}
            aria-label="Pin to the top"
            className="peer sr-only"
          />
          <NavIconSvg icon="pin" className="size-5" />
        </label>
        <label
          title="Last day it shows (leave empty to keep it up)"
          className="flex min-w-0 flex-1 items-center gap-2"
        >
          <NavIconSvg icon="clock" className="size-5 shrink-0 text-muted" />
          <input
            type="date"
            name="expiresOn"
            min={today}
            defaultValue={expiresOn}
            aria-label="Last day it shows"
            className={`${inputBase} min-w-0`}
          />
        </label>
      </div>
    </ActionForm>
  );
}

function NoticeRow({
  notice,
  today,
}: {
  notice: AnnouncementRow;
  today: string;
}) {
  return (
    <li className="py-3">
      <details className="group">
        <summary className="flex cursor-pointer list-none items-start gap-3 [&::-webkit-details-marker]:hidden">
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-1.5">
              {notice.pinned && (
                <>
                  <NavIconSvg icon="pin" className="size-4 shrink-0" />
                  <span className="sr-only">Pinned:</span>
                </>
              )}
              <span className="truncate font-medium">{notice.title}</span>
            </span>
            {notice.body && (
              <span className="mt-0.5 line-clamp-2 block text-sm whitespace-pre-line text-muted">
                {notice.body}
              </span>
            )}
            {notice.expiresAt && (
              <span className="mt-1 flex items-center gap-1 text-xs text-muted">
                <NavIconSvg icon="clock" className="size-3.5" />
                {formatShortDate(todayAtGym(notice.expiresAt), today)}
              </span>
            )}
          </span>
          <span
            title="Edit"
            className={`${iconButton} group-open:bg-ink group-open:text-white group-open:ring-ink`}
          >
            <NavIconSvg icon="pencil" className="size-4" />
          </span>
        </summary>
        <div className="mt-2 flex gap-2">
          <IconAction
            action={pinAnnouncement}
            fields={{
              announcementId: notice.id,
              pinned: String(!notice.pinned),
            }}
            icon="pin"
            label={notice.pinned ? "Unpin" : "Pin to the top"}
            pressed={notice.pinned}
            className={`${iconButton} ${notice.pinned ? "bg-ink text-white ring-ink" : ""}`}
          />
          <IconAction
            action={deleteAnnouncement}
            fields={{ announcementId: notice.id }}
            icon="trash"
            label="Remove this notice"
            confirm
            className={iconButton}
          />
        </div>
        <NoticeForm today={today} notice={notice} />
      </details>
    </li>
  );
}
