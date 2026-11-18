// The owner's and managers' Home control for notices to members: a button
// that opens a dialog. Every control has an accessible name and a hover
// title saying what it does. Closing the gym lives in Settings.
import { useState } from "react";
import { NavIconSvg } from "@/components/nav/nav-icons";
import { ActionForm } from "@/components/ui/action-form";
import { Dialog } from "@/components/ui/dialog";
import { Checkbox, Field, inputClass } from "@/components/ui/field";
import { formatShortDate, todayAtGym } from "@/lib/dates";
import {
  deleteAnnouncement,
  pinAnnouncement,
  saveAnnouncement,
} from "@/bulletin/actions";
import type { AnnouncementRow, TodayControls } from "@/bulletin/queries";
import { IconAction } from "@/bulletin/components/icon-action";

/**
 * Notices on Home: one button with the number live, opening a dialog to
 * post a notice and pin, edit or remove the live ones.
 */
export function Notices({
  controls,
  className = "",
}: {
  controls: TodayControls;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const live = controls.announcements.length;
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Notices for members"
        className={`flex min-h-16 items-center gap-3 self-start card px-4 py-3 text-left transition-colors hover:bg-canvas/50 sm:px-5 ${className}`}
      >
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-ink text-white">
          <NavIconSvg icon="megaphone" className="size-4" />
        </span>
        <span className="min-w-0 flex-1 font-medium">Notices</span>
        {live > 0 && (
          <span className="flex min-w-7 items-center justify-center rounded-badge bg-canvas px-2 py-1 text-xs font-semibold tabular-nums">
            {live}
            <span className="sr-only"> live</span>
          </span>
        )}
      </button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Notices">
        {/* Mounted only while open, so the form starts empty each time. */}
        {open && (
          <>
            <NoticeForm today={controls.today} />
            {live > 0 && (
              <section aria-label="Live notices" className="mt-6">
                <h3 className="text-sm font-medium text-muted">
                  Live now · {live}
                </h3>
                <ul className="mt-1 divide-y divide-line border-t border-line">
                  {controls.announcements.map((notice) => (
                    <NoticeRow
                      key={notice.id}
                      notice={notice}
                      today={controls.today}
                    />
                  ))}
                </ul>
              </section>
            )}
          </>
        )}
      </Dialog>
    </>
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
      pendingLabel={notice ? "Saving…" : "Posting…"}
      className={notice ? "mt-4 space-y-4" : "space-y-4"}
    >
      {notice && (
        <input type="hidden" name="announcementId" value={notice.id} />
      )}
      <Field label="Heading" hint="Shown as the notification's title.">
        <input
          name="title"
          required
          maxLength={120}
          defaultValue={notice?.title}
          className={`${inputClass} font-semibold`}
        />
      </Field>
      <Field label="Notice" hint="Optional. Phones show the first line or two.">
        <textarea
          name="body"
          rows={4}
          maxLength={2000}
          defaultValue={notice?.body}
          className={`${inputClass} py-3`}
        />
      </Field>
      <Field label="Last day it shows" hint="Leave empty to keep it up.">
        <input
          type="date"
          name="expiresOn"
          min={today}
          defaultValue={expiresOn}
          className={inputClass}
        />
      </Field>
      <Checkbox
        name="pinned"
        label="Pin to the top"
        defaultChecked={notice?.pinned}
      />
      {!notice && (
        <p className="text-sm text-muted">
          Members with notifications on get it on their phones.
        </p>
      )}
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
