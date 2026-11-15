"use client";

import Link from "next/link";
import {
  isActivePath,
  useCurrentPath,
} from "@/components/nav/use-current-path";

export interface TopNavLink {
  href: string;
  label: string;
}

/** Tablet and desktop section links; the current one is underlined. */
export function TopNav({ links }: { links: TopNavLink[] }) {
  const { current, markTapped } = useCurrentPath();

  return (
    <nav aria-label="Sections" className="hidden border-t border-ash sm:block">
      <ul className="mx-auto flex max-w-5xl gap-6 px-4 text-sm font-bold tracking-[0.08em] uppercase">
        {links.map((link) => {
          const active = isActivePath(current, link.href);
          return (
            <li key={link.href}>
              <Link
                href={link.href}
                onClick={(event) => markTapped(event, link.href)}
                aria-current={active ? "page" : undefined}
                className={`inline-flex min-h-12 items-center border-b-4 ${
                  active ? "border-white" : "border-transparent opacity-80"
                }`}
              >
                {link.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
