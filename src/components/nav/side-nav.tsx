"use client";

import Link from "@/components/ui/link";
import type { ReactNode } from "react";
import { NavIconSvg, type NavIcon } from "@/components/nav/nav-icons";
import {
  isActivePath,
  useCurrentPath,
} from "@/components/nav/use-current-path";

export interface SideNavLink {
  href: string;
  label: string;
  icon: NavIcon;
}

/**
 * Wide-screen navigation: a white panel down the left edge. The current
 * section is a dark pill; the main tabs come first, the rest under a quiet
 * "Manage" heading, and the signed-in person with sign-out at the foot.
 */
export function SideNav({
  brand,
  primary,
  secondary,
  person,
  signOut,
}: {
  brand: ReactNode;
  primary: SideNavLink[];
  secondary: SideNavLink[];
  person: { name: string; role: string };
  signOut: () => Promise<void>;
}) {
  const { current, markTapped } = useCurrentPath();

  const list = (links: SideNavLink[]) => (
    <ul className="space-y-1">
      {links.map((link) => {
        const active = isActivePath(current, link.href);
        return (
          <li key={link.href}>
            <Link
              href={link.href}
              onClick={(event) => markTapped(event, link.href)}
              aria-current={active ? "page" : undefined}
              className={`flex min-h-11 items-center gap-3 rounded-control px-4 text-[0.92rem] font-medium transition-colors duration-150 ${
                active
                  ? "bg-ink text-white shadow-card"
                  : "text-ink/75 hover:bg-canvas hover:text-ink"
              }`}
            >
              <NavIconSvg
                icon={link.icon}
                className="size-[1.15rem] shrink-0"
              />
              {link.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );

  return (
    <aside className="sticky top-4 hidden h-[calc(100svh-2rem)] w-60 shrink-0 flex-col rounded-card bg-white p-4 shadow-card lg:flex">
      <div className="px-2 pt-2 pb-8">{brand}</div>
      <nav aria-label="Sections" className="flex-1 overflow-y-auto">
        {list(primary)}
        {secondary.length > 0 && (
          <>
            <p className="mt-8 mb-2 px-4 text-[0.7rem] font-semibold tracking-[0.12em] text-muted uppercase">
              Manage
            </p>
            {list(secondary)}
          </>
        )}
      </nav>
      <div className="mt-4 flex items-center gap-3 rounded-tile bg-canvas p-2 pl-3">
        <Initial name={person.name} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{person.name}</p>
          <p className="truncate text-xs text-muted">{person.role}</p>
        </div>
        <form action={signOut}>
          <button
            type="submit"
            aria-label="Sign out"
            title="Sign out"
            className="flex size-10 items-center justify-center rounded-control text-muted transition-colors hover:bg-white hover:text-ink"
          >
            <NavIconSvg icon="signOut" className="size-5" />
          </button>
        </form>
      </div>
    </aside>
  );
}

export function Initial({
  name,
  className = "size-9 text-sm",
}: {
  name: string;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={`flex shrink-0 items-center justify-center rounded-control bg-ink font-semibold text-white ${className}`}
    >
      {name.trim().charAt(0).toUpperCase() || "?"}
    </span>
  );
}
