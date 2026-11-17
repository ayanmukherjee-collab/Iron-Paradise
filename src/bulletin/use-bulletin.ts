"use client";

import { useEffect, useSyncExternalStore } from "react";
import { BULLETIN_URL } from "@/bulletin/source";
import { bulletin, type Bulletin } from "@/bulletin/types";

// bulletin.json, fetched in the browser straight from the data Worker. This
// never runs the app's Worker. When to fetch:
// - when the app opens (the first component that asks);
// - when the app comes back into view, if the last fetch is over 5 minutes
//   old;
// - never on a timer.
// The browser keeps the file for 60 s (its Cache-Control), and the service
// worker keeps a copy to show at once and offline (stale-while-revalidate),
// so most of these fetches never leave the phone.

const REFRESH_AFTER_MS = 5 * 60 * 1000;

let current: Bulletin | null = null;
let fetchedAt = 0;
let inFlight: Promise<void> | null = null;
const listeners = new Set<() => void>();

function load(): Promise<void> {
  inFlight ??= fetch(BULLETIN_URL)
    .then((response) => (response.ok ? response.json() : null))
    .then((json) => {
      const parsed = bulletin.safeParse(json);
      // A newer version only: never step back to an older copy.
      if (parsed.success && parsed.data.version >= (current?.version ?? -1)) {
        current = parsed.data;
        listeners.forEach((notify) => notify());
      }
      fetchedAt = Date.now();
    })
    .catch(() => {
      // Offline with nothing cached: keep what we have and try next time.
    })
    .finally(() => {
      inFlight = null;
    });
  return inFlight;
}

function refreshIfStale() {
  if (Date.now() - fetchedAt > REFRESH_AFTER_MS) void load();
}

function subscribe(notify: () => void) {
  listeners.add(notify);
  return () => listeners.delete(notify);
}

/** The latest bulletin, or null until it has loaded. */
export function useBulletin(): Bulletin | null {
  const value = useSyncExternalStore(
    subscribe,
    () => current,
    () => null,
  );

  useEffect(() => {
    if (fetchedAt === 0) void load();
    else refreshIfStale();
    const onVisible = () => {
      if (document.visibilityState === "visible") refreshIfStale();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);

  return value;
}

/**
 * Re-renders every minute, so time-based text ("closes 10 PM") stays right
 * without fetching anything.
 */
export function useMinuteClock(): Date {
  const now = useSyncExternalStore(
    subscribeMinute,
    () => minuteNow,
    () => minuteNow,
  );
  return now;
}

let minuteNow = new Date();
const minuteListeners = new Set<() => void>();
let minuteTimer: ReturnType<typeof setInterval> | null = null;

function subscribeMinute(notify: () => void) {
  minuteListeners.add(notify);
  if (!minuteTimer) {
    minuteNow = new Date();
    minuteTimer = setInterval(() => {
      minuteNow = new Date();
      minuteListeners.forEach((n) => n());
    }, 60_000);
  }
  return () => {
    minuteListeners.delete(notify);
    if (!minuteListeners.size && minuteTimer) {
      clearInterval(minuteTimer);
      minuteTimer = null;
    }
  };
}
