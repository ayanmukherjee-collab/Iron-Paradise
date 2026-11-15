"use client";

import { usePathname } from "next/navigation";
import { useState, type MouseEvent } from "react";

/**
 * The path the nav should show as current. A tapped tab lights up at once,
 * before its page arrives, so the app answers the tap instantly. Once the
 * route actually changes, the real pathname takes over again.
 */
export function useCurrentPath() {
  const pathname = usePathname();
  const [tap, setTap] = useState<{ href: string; from: string } | null>(null);
  const current = tap && tap.from === pathname ? tap.href : pathname;

  function markTapped(event: MouseEvent, href: string) {
    // Opening in a new tab or window does not navigate this one.
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
      return;
    if (event.button !== 0) return;
    setTap({ href, from: pathname });
  }

  return { current, markTapped };
}

export function isActivePath(pathname: string, href: string): boolean {
  return href === "/app"
    ? pathname === "/app"
    : pathname === href || pathname.startsWith(`${href}/`);
}
