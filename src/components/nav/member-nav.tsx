"use client";

import Link from "@/components/ui/link";
import { useEffect, useState } from "react";
import { NavIconSvg } from "@/components/nav/nav-icons";
import type { NavItem } from "@/components/nav/bottom-nav";
import {
  isActivePath as isActive,
  useCurrentPath,
} from "@/components/nav/use-current-path";

/**
 * A member's phone navigation: a black bar on the bottom edge with Home on
 * the left, a raised round Check in button in the middle (what members do
 * most) and their account on the right. The account panel shows who is
 * signed in, any extra pages, and sign-out. Hidden on wide screens, where
 * the sidebar takes over.
 */
export function MemberNav({
  home,
  checkIn,
  more,
  person,
  signOut,
}: {
  home: NavItem;
  checkIn: NavItem | null;
  more: NavItem[];
  person: { name: string; role: string };
  signOut: () => Promise<void>;
}) {
  const { current: pathname, markTapped } = useCurrentPath();
  const [open, setOpen] = useState(false);
  const homeActive = isActive(pathname, home.href) && !open;
  const checkInActive = !!checkIn && isActive(pathname, checkIn.href) && !open;
  const accountActive =
    open || more.some((item) => isActive(pathname, item.href));

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) =>
      event.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const initials = person.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]!.toUpperCase())
    .join("");

  return (
    <div className="lg:hidden">
      {open && (
        <>
          <button
            type="button"
            aria-label="Close menu"
            tabIndex={-1}
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40 bg-ink/30 backdrop-blur-[2px]"
          />
          <div
            id="account-menu"
            className="fixed inset-x-4 bottom-[calc(7.75rem+env(safe-area-inset-bottom))] z-50 mx-auto max-w-md origin-bottom overflow-hidden rounded-card bg-white shadow-float motion-safe:animate-rise"
          >
            <div className="relative isolate flex items-center gap-3 overflow-hidden bg-ink p-4 text-white">
              <div
                aria-hidden="true"
                className="absolute inset-0 -z-10 screentone [mask-image:radial-gradient(90%_140%_at_100%_0%,black,transparent_60%)] text-white/[0.12]"
              />
              <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-white font-semibold text-ink">
                {initials || "?"}
              </span>
              <span className="min-w-0">
                <span className="block truncate font-semibold">
                  {person.name}
                </span>
                <span className="block text-sm text-white/60">
                  {person.role}
                </span>
              </span>
            </div>
            <ul className="p-2">
              {more.map((item) => {
                const active = isActive(pathname, item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={(event) => {
                        setOpen(false);
                        markTapped(event, item.href);
                      }}
                      aria-current={active ? "page" : undefined}
                      className={`flex min-h-14 items-center gap-3 rounded-tile px-3 font-medium transition-colors ${active ? "bg-ink text-white" : "hover:bg-canvas"}`}
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
              <li>
                <form action={signOut}>
                  <button
                    type="submit"
                    className="flex min-h-14 w-full items-center gap-3 rounded-tile px-3 text-left font-medium text-muted transition-colors hover:bg-canvas hover:text-ink"
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
        className="fixed inset-x-4 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-50 mx-auto max-w-md"
      >
        <ul className="relative grid h-16 grid-cols-3 items-center rounded-panel bg-ink px-2 text-white shadow-float ring-1 ring-white/10">
          <li className="flex justify-center">
            <Link
              href={home.href}
              onClick={(event) => {
                setOpen(false);
                markTapped(event, home.href);
              }}
              aria-current={homeActive ? "page" : undefined}
              className={tab(homeActive)}
            >
              <NavIconSvg icon={home.icon} className="size-[1.35rem]" />
              <span className="text-[0.7rem] font-medium">{home.label}</span>
              <Dot on={homeActive} />
            </Link>
          </li>

          <li className="flex justify-center">
            {checkIn && (
              <Link
                href={checkIn.href}
                onClick={(event) => {
                  setOpen(false);
                  markTapped(event, checkIn.href);
                }}
                aria-current={checkInActive ? "page" : undefined}
                aria-label={checkIn.label}
                className={`-mt-9 flex size-[4.25rem] items-center justify-center rounded-full shadow-float ring-[5px] ring-canvas transition-transform duration-150 active:scale-95 ${checkInActive ? "bg-blaze text-white" : "bg-white text-ink"}`}
              >
                <NavIconSvg icon="qr" className="size-7" />
              </Link>
            )}
          </li>

          <li className="flex justify-center">
            <button
              type="button"
              aria-expanded={open}
              aria-controls="account-menu"
              onClick={() => setOpen((value) => !value)}
              className={tab(accountActive)}
            >
              <NavIconSvg icon="user" className="size-[1.35rem]" />
              <span className="text-[0.7rem] font-medium">Account</span>
              <Dot on={accountActive} />
            </button>
          </li>
        </ul>
      </nav>
    </div>
  );
}

function tab(active: boolean): string {
  return `relative flex h-14 w-20 flex-col items-center justify-center gap-0.5 rounded-tile transition-colors duration-200 ${active ? "text-white" : "text-white/55 hover:text-white"}`;
}

function Dot({ on }: { on: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`absolute bottom-0.5 size-1 rounded-full bg-blaze transition-opacity ${on ? "opacity-100" : "opacity-0"}`}
    />
  );
}
