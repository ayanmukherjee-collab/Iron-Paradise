import { useEffect, useSyncExternalStore } from "react";
import { bulletin, type Bulletin } from "@/bulletin/types";
import { supabase } from "../lib/supabase";

// The static app's version of src/bulletin/use-bulletin.ts (vite.config.ts
// points the shared components here): the bulletin comes straight from the
// database (public.bulletin) instead of a file in Cloudflare KV. When to
// fetch, as before:
// - when the app opens (the first component that asks);
// - when the app comes back into view, if the last fetch is over 5 minutes
//   old;
// - never on a timer.

const REFRESH_AFTER_MS = 5 * 60 * 1000;

let current: Bulletin | null = null;
let fetchedAt = 0;
let inFlight: Promise<void> | null = null;
const listeners = new Set<() => void>();

function load(): Promise<void> {
  inFlight ??= Promise.resolve(supabase.rpc("bulletin"))
    .then(({ data: json }) => {
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
