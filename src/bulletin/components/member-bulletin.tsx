"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { NavIconSvg } from "@/components/nav/nav-icons";
import {
  addDays,
  clockLabel,
  dayLabel,
  getOpenStatus,
  gymMoment,
  hoursOn,
  openBlocksOn,
  type OpenStatus,
} from "@/bulletin/hours";
import type { Announcement, Bulletin } from "@/bulletin/types";
import { useBulletin, useMinuteClock } from "@/bulletin/use-bulletin";

/**
 * The members' bulletin board: open or closed right now, the next seven days
 * of hours drawn as bars (closures included), and the gym's notices, pinned
 * first. Everything is read from bulletin.json in the browser; nothing here
 * runs the app's Worker.
 */
export function MemberBulletin({ className = "" }: { className?: string }) {
  const data = useBulletin();
  const now = useMinuteClock();
  if (!data) {
    return (
      <div
        aria-hidden="true"
        className={`h-80 card motion-safe:animate-pulse ${className}`}
      />
    );
  }

  const status = getOpenStatus(data, now);
  const notices = data.announcements
    .filter((notice) => !notice.expiresAt || new Date(notice.expiresAt) > now)
    .sort(
      (a, b) =>
        Number(b.pinned) - Number(a.pinned) ||
        b.createdAt.localeCompare(a.createdAt),
    );

  return (
    <section
      aria-label="Bulletin"
      className={`overflow-hidden card ${className}`}
    >
      <StatusHeader status={status} />
      <WeekHours source={data} now={now} />
      {notices.length > 0 && <NoticeList notices={notices} now={now} />}
    </section>
  );
}

function StatusHeader({ status }: { status: OpenStatus }) {
  const open = status.state === "open";
  let detail: string;
  if (status.state === "open") {
    detail = `Until ${clockLabel(status.closes)}`;
  } else if (status.closure) {
    detail = status.closure.reason.trim() || "All day today";
  } else {
    const next = status.label.split(" · ")[1] ?? "";
    detail = next.charAt(0).toUpperCase() + next.slice(1);
  }

  return (
    <div
      role="status"
      className={`relative isolate flex items-center gap-4 overflow-hidden p-5 sm:px-6 ${open ? "bg-ink text-white" : "bg-canvas text-ink"}`}
    >
      <div
        aria-hidden="true"
        className={`absolute inset-0 -z-10 screentone [mask-image:radial-gradient(90%_140%_at_100%_0%,black,transparent_60%)] ${open ? "text-white/[0.12]" : "text-ink/[0.08]"}`}
      />
      <span
        aria-hidden="true"
        className={`relative flex size-11 shrink-0 items-center justify-center rounded-full ${open ? "bg-white/10" : "bg-white"}`}
      >
        {open && (
          <span className="absolute inset-1 rounded-full bg-white/20 motion-safe:animate-ping" />
        )}
        <span
          className={`relative size-3 rounded-full ${open ? "bg-white" : "bg-ink/30"}`}
        />
      </span>
      <div className="min-w-0">
        <p
          className={`text-[0.65rem] font-semibold tracking-[0.18em] uppercase ${open ? "text-white/55" : "text-muted"}`}
        >
          Bulletin
        </p>
        <p className="mt-0.5 font-display text-3xl leading-none tracking-wide uppercase">
          {open ? "Open now" : "Closed"}
        </p>
        <p
          className={`mt-1 truncate text-sm ${open ? "text-white/70" : "text-muted"}`}
        >
          {detail}
        </p>
      </div>
    </div>
  );
}

const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const dayMinutes = 24 * 60;
const pct = (minutes: number) => `${(minutes / dayMinutes) * 100}%`;
// Diagonal stripes, so a closed day reads apart from an empty bar.
const closedFill =
  "bg-[repeating-linear-gradient(-45deg,rgb(12_12_13/0.16)_0_2px,transparent_2px_6px)]";

/** Today and the six days after it, each on a midnight-to-midnight bar. */
function WeekHours({ source, now }: { source: Bulletin; now: Date }) {
  const { date: today, minutes } = gymMoment(now);
  const days = Array.from({ length: 7 }, (_, i) => addDays(today, i));

  return (
    <div className="p-5 sm:px-6">
      <ul className="space-y-2.5">
        {days.map((date) => {
          const blocks = openBlocksOn(source, date);
          const { closure } = hoursOn(source, date);
          const closed = blocks.length === 0;
          const isToday = date === today;
          const name = isToday
            ? "Today"
            : weekdays[new Date(`${date}T00:00:00Z`).getUTCDay()];
          const said = closed
            ? "closed"
            : `open ${blocks.map((b) => `${clock(b.from)} to ${clock(b.to)}`).join(", ")}`;
          return (
            <li key={date}>
              <div className="grid grid-cols-[3.25rem_1fr_0.5rem] items-center gap-3">
                <span
                  className={`text-sm ${isToday ? "font-semibold" : "text-muted"}`}
                >
                  {name}
                </span>
                <span
                  role="img"
                  aria-label={`${isToday ? "Today" : dayLabel(date)}: ${said}${closure?.reason ? `, ${closure.reason}` : ""}`}
                  className={`relative block h-3 overflow-hidden rounded-full ${closed ? closedFill : "bg-ink/[0.06]"}`}
                >
                  {blocks.map((block) => (
                    <span
                      key={block.from}
                      className={`absolute inset-y-0 rounded-full ${isToday ? "bg-ink" : "bg-ink/60"}`}
                      style={{
                        left: pct(block.from),
                        width: pct(block.to - block.from),
                      }}
                    />
                  ))}
                  {isToday && (
                    <span
                      aria-hidden="true"
                      className="absolute inset-y-0 w-0.5 -translate-x-1/2 bg-blaze"
                      style={{ left: pct(minutes) }}
                    />
                  )}
                </span>
                {closure ? (
                  <span
                    title={closure.reason || "Changed hours"}
                    className="size-2 rounded-full bg-blaze"
                  >
                    <span className="sr-only">Changed hours</span>
                  </span>
                ) : (
                  <span />
                )}
              </div>
              {closure?.reason && (
                <p className="mt-1 pl-16 text-xs text-muted">
                  {closed ? "Closed" : "Short hours"} · {closure.reason}
                </p>
              )}
            </li>
          );
        })}
      </ul>
      <div
        aria-hidden="true"
        className="mt-2 grid grid-cols-[3.25rem_1fr_0.5rem] gap-3 text-[0.65rem] text-muted"
      >
        <span />
        <span className="relative h-3">
          {[6, 12, 18].map((hour) => (
            <span
              key={hour}
              className="absolute -translate-x-1/2"
              style={{ left: pct(hour * 60) }}
            >
              {hour === 12 ? "12p" : hour < 12 ? `${hour}a` : `${hour - 12}p`}
            </span>
          ))}
        </span>
        <span />
      </div>
    </div>
  );
}

/** "5:30 AM" from minutes after midnight. */
function clock(minutes: number): string {
  const hours = Math.floor(minutes / 60) % 24;
  return clockLabel(
    `${String(hours).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`,
  );
}

/** "now", "3h", "2d", else "Fri 20 Nov". */
function ago(createdAt: string, now: Date): string {
  const minutes = (now.getTime() - new Date(createdAt).getTime()) / 60_000;
  if (minutes < 60) return "now";
  if (minutes < 24 * 60) return `${Math.floor(minutes / 60)}h`;
  if (minutes < 7 * 24 * 60) return `${Math.floor(minutes / (24 * 60))}d`;
  return dayLabel(gymMoment(new Date(createdAt)).date);
}

const SEEN_KEY = "ip:notices-seen";

interface Seen {
  id: string;
  createdAt: string;
}

function readSeen(): Seen | null {
  try {
    const raw = localStorage.getItem(SEEN_KEY);
    return raw ? (JSON.parse(raw) as Seen) : null;
  } catch {
    return null;
  }
}

/**
 * The notices, with a dot on each one the phone hasn't shown before. "Seen"
 * is the newest notice once the list has been on screen for a moment; it's
 * stored on this phone only (localStorage), with its time, so a seen notice
 * that later expires doesn't make every older one look new. Pinned notices
 * come first, on black.
 */
function NoticeList({ notices, now }: { notices: Announcement[]; now: Date }) {
  const listRef = useRef<HTMLElement>(null);
  // Read once per visit, so dots stay while the person reads.
  const [seen] = useState<Seen | null>(() =>
    typeof window === "undefined" ? null : readSeen(),
  );
  const newest = useMemo(
    () =>
      notices.reduce(
        (a, b) => (a.createdAt >= b.createdAt ? a : b),
        notices[0],
      ),
    [notices],
  );
  const isNew = (notice: Announcement) =>
    !seen || (notice.id !== seen.id && notice.createdAt > seen.createdAt);

  useEffect(() => {
    const node = listRef.current;
    if (!node || (seen && seen.id === newest.id)) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const observer = new IntersectionObserver(([entry]) => {
      clearTimeout(timer);
      if (!entry.isIntersecting) return;
      timer = setTimeout(() => {
        try {
          localStorage.setItem(
            SEEN_KEY,
            JSON.stringify({ id: newest.id, createdAt: newest.createdAt }),
          );
        } catch {
          // Private mode: dots just show again next time.
        }
        observer.disconnect();
      }, 1500);
    });
    observer.observe(node);
    return () => {
      clearTimeout(timer);
      observer.disconnect();
    };
  }, [newest, seen]);

  return (
    <section
      ref={listRef}
      aria-label="Notices"
      className="border-t border-line p-5 sm:px-6"
    >
      <h2 className="flex items-center gap-2 font-semibold tracking-tight">
        <NavIconSvg icon="megaphone" className="size-5" />
        Notices
        {notices.some(isNew) && (
          <span className="size-2 rounded-full bg-blaze">
            <span className="sr-only">New</span>
          </span>
        )}
      </h2>
      <ul className="mt-3 space-y-2">
        {notices.map((notice) => (
          <li
            key={notice.id}
            className={`rounded-tile p-4 ${notice.pinned ? "bg-ink text-white" : "bg-canvas"}`}
          >
            <div className="flex items-start gap-2">
              {notice.pinned && (
                <>
                  <NavIconSvg icon="pin" className="mt-0.5 size-4 shrink-0" />
                  <span className="sr-only">Pinned:</span>
                </>
              )}
              <p className="min-w-0 flex-1 font-semibold break-words">
                {notice.title}
                {isNew(notice) && (
                  <span
                    aria-hidden="true"
                    className="ml-1.5 inline-block size-1.5 -translate-y-0.5 rounded-full bg-blaze"
                  />
                )}
              </p>
              <span
                className={`shrink-0 text-xs tabular-nums ${notice.pinned ? "text-white/55" : "text-muted"}`}
              >
                {ago(notice.createdAt, now)}
              </span>
            </div>
            {/* Plain text: React escapes it, and line breaks are kept. */}
            {notice.body && (
              <p
                className={`mt-1 text-sm whitespace-pre-line ${notice.pinned ? "text-white/75" : "text-muted"}`}
              >
                {notice.body}
              </p>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
