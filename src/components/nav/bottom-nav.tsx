"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { NavIconSvg, type NavIcon } from "@/components/nav/nav-icons";

export interface NavItem {
  href: string;
  label: string;
  icon: NavIcon;
}

export interface MoreItem {
  href: string;
  label: string;
}

function isActive(pathname: string, href: string): boolean {
  return href === "/app" ? pathname === "/app" : pathname.startsWith(href);
}

/**
 * Phone navigation: a black bar on the bottom edge where the current tab
 * rises into a square notch. Pages that don't fit (Team, Audit, Settings)
 * and sign-out live behind "More". Hidden from tablet width up, where the
 * top bar has room for everything.
 */
export function BottomNav({
  items,
  more,
  signOut,
}: {
  items: NavItem[];
  more: MoreItem[];
  signOut: () => Promise<void>;
}) {
  const pathname = usePathname();
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
    <div className="sm:hidden">
      {moreOpen && (
        <div
          id="more-menu"
          className="fixed inset-x-0 bottom-16 z-40 border-t-4 border-ink bg-paper px-4 pt-2 pb-6"
        >
          <ul>
            {more.map((item) => (
              <li key={item.href} className="border-b-2 border-ink">
                <Link
                  href={item.href}
                  onClick={() => setMoreOpen(false)}
                  aria-current={
                    isActive(pathname, item.href) ? "page" : undefined
                  }
                  className="flex min-h-14 items-center justify-between text-sm font-bold tracking-[0.08em] uppercase"
                >
                  {item.label}
                  <span aria-hidden="true">→</span>
                </Link>
              </li>
            ))}
            <li>
              <form action={signOut}>
                <button
                  type="submit"
                  className="min-h-14 w-full text-left text-sm font-bold tracking-[0.08em] uppercase underline underline-offset-4"
                >
                  Sign out
                </button>
              </form>
            </li>
          </ul>
        </div>
      )}

      <nav
        aria-label="Sections"
        className="fixed inset-x-0 bottom-0 z-50 h-16 bg-ink text-white"
      >
        <ul
          className="grid h-full"
          style={{
            gridTemplateColumns: `repeat(${slots.length}, minmax(0, 1fr))`,
          }}
        >
          {slots.map((slot) => {
            const content = (
              <>
                {slot.active ? (
                  // The raised block. Its paper-coloured ring cuts the notch
                  // out of the bar, like the reference, but square.
                  <span className="absolute -top-6 left-1/2 flex size-14 -translate-x-1/2 items-center justify-center border-4 border-paper bg-ink">
                    <NavIconSvg icon={slot.icon} className="size-6" />
                  </span>
                ) : (
                  <NavIconSvg icon={slot.icon} className="size-6 opacity-80" />
                )}
                <span
                  className={`text-[0.65rem] font-bold tracking-[0.08em] uppercase ${slot.active ? "mt-auto mb-2" : "mt-1"}`}
                >
                  {slot.label}
                </span>
              </>
            );
            const cell =
              "relative flex h-full w-full flex-col items-center justify-center";

            return (
              <li key={slot.label} className="h-full">
                {slot.href ? (
                  <Link
                    href={slot.href}
                    onClick={() => setMoreOpen(false)}
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
