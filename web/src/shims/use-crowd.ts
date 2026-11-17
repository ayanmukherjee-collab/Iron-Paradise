import { useEffect, useSyncExternalStore, type RefObject } from "react";
import { crowdFile, type CrowdFile } from "@/bulletin/crowd";
import { supabase } from "../lib/supabase";

// The static app's version of src/bulletin/use-crowd.ts: recent check-in
// times come straight from the database (public.crowd), not from a file in
// Cloudflare KV. When to fetch:
// - when the app opens (the first crowd card that asks);
// - when the app comes back into view, if the last fetch is over 5 minutes
//   old;
// - while the crowd card is on screen and the app is in view, at most every
//   2 minutes. Never in the background.
// Between fetches the phone keeps fading people out on its own (crowd.ts).

const REFRESH_AFTER_MS = 5 * 60 * 1000;
const ON_SCREEN_EVERY_MS = 2 * 60 * 1000;
const CHECK_EVERY_MS = 30 * 1000;

let current: CrowdFile | null = null;
let fetchedAt = 0;
let inFlight: Promise<void> | null = null;
const listeners = new Set<() => void>();

function load(): Promise<void> {
  inFlight ??= Promise.resolve(supabase.rpc("crowd"))
    .then(({ data: json }) => {
      const parsed = crowdFile.safeParse(json);
      // Never step back to an older copy.
      if (
        parsed.success &&
        (!current || parsed.data.generatedAt >= current.generatedAt)
      ) {
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

function refreshIfOlderThan(ms: number) {
  if (Date.now() - fetchedAt > ms) void load();
}

function subscribe(notify: () => void) {
  listeners.add(notify);
  return () => listeners.delete(notify);
}

/**
 * The latest check-in times, or null until they have loaded. `card` is the
 * element showing them: refreshes beyond the 5-minute rule happen only
 * while it's on screen.
 */
export function useCrowd(card: RefObject<Element | null>): CrowdFile | null {
  const value = useSyncExternalStore(
    subscribe,
    () => current,
    () => null,
  );

  useEffect(() => {
    if (fetchedAt === 0) void load();
    else refreshIfOlderThan(REFRESH_AFTER_MS);

    let onScreen = false;
    const inView = () => document.visibilityState === "visible";

    const onVisible = () => {
      if (inView()) refreshIfOlderThan(REFRESH_AFTER_MS);
    };
    document.addEventListener("visibilitychange", onVisible);

    const node = card.current;
    const observer = node
      ? new IntersectionObserver(([entry]) => {
          onScreen = entry.isIntersecting;
          if (onScreen && inView()) refreshIfOlderThan(ON_SCREEN_EVERY_MS);
        })
      : null;
    if (node) observer?.observe(node);

    const timer = setInterval(() => {
      if (onScreen && inView()) refreshIfOlderThan(ON_SCREEN_EVERY_MS);
    }, CHECK_EVERY_MS);

    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      observer?.disconnect();
      clearInterval(timer);
    };
  }, [card]);

  return value;
}
