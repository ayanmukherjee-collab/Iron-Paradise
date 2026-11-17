"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { NavIconSvg } from "@/components/nav/nav-icons";
import {
  closuresWithin,
  dayLabel,
  getOpenStatus,
  gymMoment,
  rangeLabel,
} from "@/bulletin/hours";
import type { Announcement, Closure } from "@/bulletin/types";
import { useBulletin, useMinuteClock } from "@/bulletin/use-bulletin";

/**
 * What members see from the bulletin: open or closed now, any closure in
 * the next three days, and the gym's notices. Everything is read from
 * bulletin.json in the browser; nothing here runs the app's Worker.
 */
export function MemberBulletin() {
  const data = useBulletin();
  const now = useMinuteClock();
  if (!data) return null;

  const status = getOpenStatus(data, now);
  const soon = closuresWithin(data, now, 3);
  const notices = data.announcements.filter(
    (notice) => !notice.expiresAt || new Date(notice.expiresAt) > now,
  );

  return (
    <div className="mt-6 space-y-4">
      <p
        className={`inline-flex items-center gap-2 rounded-badge px-3 py-1.5 text-sm font-medium ${status.state === "open" ? "bg-ink text-white" : "bg-white text-ink ring-1 ring-line"}`}
      >
        <span
          aria-hidden="true"
          className={`size-2 rounded-full ${status.state === "open" ? "bg-white motion-safe:animate-pulse" : "bg-ink/30"}`}
        />
        {status.label}
      </p>

      {soon.length > 0 && <ClosureBanner closures={soon} now={now} />}
      {notices.length > 0 && <NoticeList notices={notices} />}
    </div>
  );
}

function ClosureBanner({ closures, now }: { closures: Closure[]; now: Date }) {
  const today = gymMoment(now).date;
  return (
    <div role="status" className="card-dark p-4 sm:p-5">
      <ul className="space-y-2">
        {closures.map((closure) => (
          <li key={closure.date} className="flex items-start gap-3">
            <NavIconSvg icon="power" className="mt-0.5 size-5 shrink-0" />
            <span>
              <span className="font-semibold">
                {closure.hours ? "Short hours" : "Closed"}{" "}
                {closure.date === today ? "today" : dayLabel(closure.date)}
              </span>
              {closure.hours && (
                <span className="block text-sm text-white/70">
                  Open {closure.hours.map(rangeLabel).join(" · ")}
                </span>
              )}
              {closure.reason && (
                <span className="block text-sm text-white/70">
                  {closure.reason}
                </span>
              )}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
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
 * that later expires doesn't make every older one look new.
 */
function NoticeList({ notices }: { notices: Announcement[] }) {
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
    <section ref={listRef} aria-label="Notices" className="card p-5 sm:p-6">
      <h2 className="flex items-center gap-2 font-semibold">
        <NavIconSvg icon="megaphone" className="size-5" />
        Notices
        {notices.some(isNew) && (
          <span className="size-2 rounded-full bg-blaze">
            <span className="sr-only">New</span>
          </span>
        )}
      </h2>
      <ul className="mt-3 divide-y divide-line">
        {notices.map((notice) => (
          <li key={notice.id} className="py-3 first:pt-0 last:pb-0">
            <p className="flex items-center gap-1.5 font-medium">
              {notice.pinned && (
                <>
                  <NavIconSvg icon="pin" className="size-4 shrink-0" />
                  <span className="sr-only">Pinned:</span>
                </>
              )}
              {notice.title}
              {isNew(notice) && (
                <span
                  aria-hidden="true"
                  className="size-1.5 shrink-0 rounded-full bg-blaze"
                />
              )}
            </p>
            {/* Plain text: React escapes it, and line breaks are kept. */}
            {notice.body && (
              <p className="mt-1 text-sm whitespace-pre-line text-muted">
                {notice.body}
              </p>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
