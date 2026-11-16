"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { NavIconSvg, type NavIcon } from "@/components/nav/nav-icons";
import {
  isActivePath as isActive,
  useCurrentPath,
} from "@/components/nav/use-current-path";

export interface NavItem {
  href: string;
  label: string;
  icon: NavIcon;
}

/**
 * Phone and tablet navigation: a floating white pill on the bottom edge.
 * The current tab grows into a dark pill that shows its name; the others
 * are icons only. Pages that don't fit (Team, Audit, Settings) and sign-out
 * live behind "More". Hidden on wide screens, where the sidebar takes over.
 */
export function BottomNav({
  items,
  more,
  signOut,
}: {
  items: NavItem[];
  more: NavItem[];
  signOut: () => Promise<void>;
}) {
  const { current: pathname, markTapped } = useCurrentPath();
  const [moreOpen, setMoreOpen] = useState(false);
  const moreActive = more.some((item) => isActive(pathname, item.href));

  // Escape closes the panel; links close it on tap.
  useEffect(() => {
    if (!moreOpen) return;
    const onKey = (event: KeyboardEvent) =>
      event.key === "Escape" && setMoreOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [moreOpen]);

  const slots = [
    ...items.map((item) => ({
      ...item,
      active: isActive(pathname, item.href) && !moreOpen,
    })),
    {
      href: null,
      label: "More",
      icon: "more" as const,
      active: moreOpen || moreActive,
    },
  ];

  return (
    <div className="lg:hidden">
      {moreOpen && (
        <>
          <button
            type="button"
            aria-label="Close menu"
            tabIndex={-1}
            onClick={() => setMoreOpen(false)}
            className="fixed inset-0 z-40 bg-ink/20 backdrop-blur-[2px]"
          />
          <div
            id="more-menu"
            className="fixed inset-x-4 bottom-[calc(6rem+env(safe-area-inset-bottom))] z-50 mx-auto max-w-md origin-bottom rounded-card bg-white p-2 shadow-float motion-safe:animate-rise"
          >
            <ul>
              {more.map((item) => {
                const active = isActive(pathname, item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={(event) => {
                        setMoreOpen(false);
                        markTapped(event, item.href);
                      }}
                      aria-current={active ? "page" : undefined}
                      className={`flex min-h-14 items-center gap-3 rounded-tile px-3 text-[0.95rem] font-medium transition-colors ${
                        active ? "bg-ink text-white" : "hover:bg-canvas"
                      }`}
                    >
                      <span
                        className={`flex size-9 items-center justify-center rounded-control ${active ? "bg-white/15" : "bg-canvas"}`}
                      >
                        <NavIconSvg
                          icon={item.icon}
                          className="size-[1.15rem]"
                        />
                      </span>
                      {item.label}
                    </Link>
                  </li>
                );
              })}
              <li className="mt-1 border-t border-line pt-1">
                <form action={signOut}>
                  <button
                    type="submit"
                    className="flex min-h-14 w-full items-center gap-3 rounded-tile px-3 text-left text-[0.95rem] font-medium text-muted transition-colors hover:bg-canvas hover:text-ink"
                  >
                    <span className="flex size-9 items-center justify-center rounded-control bg-canvas">
                      <NavIconSvg icon="signOut" className="size-[1.15rem]" />
                    </span>
                    Sign out
                  </button>
                </form>
              </li>
            </ul>
          </div>
        </>
      )}

      <nav
        aria-label="Sections"
        className="fixed inset-x-4 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-50 mx-auto max-w-md rounded-tile bg-white/90 p-1.5 shadow-float ring-1 ring-line backdrop-blur-xl"
      >
        <ul className="flex items-center justify-between gap-1">
          {slots.map((slot) => {
            const content = (
              <>
                <NavIconSvg
                  icon={slot.icon}
                  className="size-[1.35rem] shrink-0"
                />
                <span
                  className={
                    slot.active
                      ? "text-[0.8rem] font-semibold whitespace-nowrap"
                      : "sr-only"
                  }
                >
                  {slot.label}
                </span>
              </>
            );
            const cell = `flex h-12 items-center justify-center gap-2 rounded-control transition-[background-color,color,padding] duration-300 ease-out ${
              slot.active
                ? "bg-ink px-4 text-white"
                : "w-12 text-ink/70 hover:bg-canvas hover:text-ink"
            }`;

            return (
              <li key={slot.label} className={slot.active ? "shrink-0" : ""}>
                {slot.href ? (
                  <Link
                    href={slot.href}
                    onClick={(event) => {
                      setMoreOpen(false);
                      markTapped(event, slot.href);
                    }}
                    aria-current={slot.active ? "page" : undefined}
                    className={cell}
                  >
                    {content}
                  </Link>
                ) : (
                  <button
                    type="button"
                    aria-expanded={moreOpen}
                    aria-controls="more-menu"
                    onClick={() => setMoreOpen((open) => !open)}
                    className={cell}
                  >
                    {content}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
