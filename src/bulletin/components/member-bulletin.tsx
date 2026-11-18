"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { NavIconSvg } from "@/components/nav/nav-icons";
import {
  clockLabel,
  dayLabel,
  gymMoment,
  hoursOn,
  openBlocksOn,
} from "@/bulletin/hours";
import type { Announcement, Bulletin } from "@/bulletin/types";
import { useBulletin, useMinuteClock } from "@/bulletin/use-bulletin";

/**
 * The members' bulletin board: today's hours on one bar, with a mark at the
 * current time, and the gym's notices, pinned first. The notices part always
 * shows, with a line when there are none. Read in the browser from the
 * bulletin; whether the gym is open right now is on the Crowd card.
 */
export function MemberBulletin({ className = "" }: { className?: string }) {
  const data = useBulletin();
  const now = useMinuteClock();
  if (!data) {
    return (
      <div
        aria-hidden="true"
        className={`h-48 card motion-safe:animate-pulse ${className}`}
      />
    );
  }

  const notices = data.announcements
    .filter((notice) => !notice.expiresAt || new Date(notice.expiresAt) > now)
    .sort(
      (a, b) =>
        Number(b.pinned) - Number(a.pinned) ||
        b.createdAt.localeCompare(a.createdAt),
    );

  return (
    <section aria-label="Bulletin" className={`card ${className}`}>
      <TodayHours source={data} now={now} />
      {notices.length > 0 ? (
        <NoticeList notices={notices} now={now} />
      ) : (
        <section
          aria-label="Notices"
          className="border-t border-line p-5 sm:px-6"
        >
          <NoticesHeading />
          <p className="mt-2 text-sm text-muted">No notices right now.</p>
        </section>
      )}
    </section>
  );
}

const dayMinutes = 24 * 60;
const pct = (minutes: number) => `${(minutes / dayMinutes) * 100}%`;
// Diagonal stripes, so a closed day reads apart from an empty bar.
const closedFill =
  "bg-[repeating-linear-gradient(-45deg,rgb(12_12_13/0.16)_0_2px,transparent_2px_6px)]";

/** Today on one midnight-to-midnight bar: the openings, and now. */
function TodayHours({ source, now }: { source: Bulletin; now: Date }) {
  const { date: today, minutes } = gymMoment(now);
  const blocks = openBlocksOn(source, today);
  const { closure } = hoursOn(source, today);
  const closed = blocks.length === 0;
  const hours = closed
    ? "Closed today"
    : blocks.map((b) => `${clock(b.from)} – ${clock(b.to)}`).join(" · ");

  return (
    <div className="p-5 sm:px-6">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-semibold tracking-tight">Today</h2>
        <span className="truncate text-sm text-muted tabular-nums">
          {hours}
        </span>
      </div>
      <span
        role="img"
        aria-label={`Today: ${closed ? "closed" : `open ${blocks.map((b) => `${clock(b.from)} to ${clock(b.to)}`).join(", ")}`}${closure?.reason ? `, ${closure.reason}` : ""}`}
        className={`relative mt-3 block h-3 overflow-hidden rounded-full ${closed ? closedFill : "bg-ink/[0.06]"}`}
      >
        {blocks.map((block) => (
          <span
            key={block.from}
            className="absolute inset-y-0 rounded-full bg-ink"
            style={{
              left: pct(block.from),
              width: pct(block.to - block.from),
            }}
          />
        ))}
        <span
          aria-hidden="true"
          className="absolute inset-y-0 w-0.5 -translate-x-1/2 bg-blaze"
          style={{ left: pct(minutes) }}
        />
      </span>
      <span
        aria-hidden="true"
        className="relative mt-1.5 block h-3 text-[0.65rem] text-muted"
      >
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
      {closure?.reason && (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-muted">
          <span aria-hidden="true" className="size-1.5 rounded-full bg-blaze" />
          {closed ? "Closed" : "Short hours"} · {closure.reason}
        </p>
      )}
    </div>
  );
}

function NoticesHeading({ fresh = false }: { fresh?: boolean }) {
  return (
    <h2 className="flex items-center gap-2 font-semibold tracking-tight">
      <NavIconSvg icon="megaphone" className="size-5" />
      Notices
      {fresh && (
        <span className="size-2 rounded-full bg-blaze">
          <span className="sr-only">New</span>
        </span>
      )}
    </h2>
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
      <NoticesHeading fresh={notices.some(isNew)} />
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
