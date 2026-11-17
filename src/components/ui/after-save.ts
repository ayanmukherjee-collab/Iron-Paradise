"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";

/**
 * What a page does once a save has succeeded: fetch fresh data for the page
 * (router.refresh, which also drops every page kept in the browser's memory),
 * or open the page the save asked for (`{ redirectTo }` in its result).
 *
 * Server Actions don't call revalidatePath or redirect. Either one makes
 * Next.js render a whole page inside the save's own request, on a Worker
 * allowed 10 ms of CPU, and a save cut off there may or may not have been
 * written, so it can't be retried. Done this way, the save request only
 * writes, and the page load after it is an ordinary GET that the service
 * worker retries if Cloudflare turns it away (src/pwa/sw.ts).
 */
export function useAfterSave() {
  const router = useRouter();

  return useCallback(
    (data?: unknown) => {
      const target = redirectOf(data);
      // A full page load, so no page the browser kept from before the save
      // (such as the members list) can show old data.
      if (target) window.location.assign(target);
      else router.refresh();
    },
    [router],
  );
}

/** The in-app page a save's result asks to open, if any. */
export function redirectOf(data: unknown): string | null {
  if (
    !data ||
    typeof data !== "object" ||
    !("redirectTo" in data) ||
    typeof data.redirectTo !== "string"
  ) {
    return null;
  }
  // Same-site paths only: never "//host", "/\host" or "javascript:" URLs.
  const target = data.redirectTo;
  return target.startsWith("/") && !/^\/[/\\]/.test(target) ? target : null;
}
