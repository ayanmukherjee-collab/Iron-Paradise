import type { ReactNode } from "react";
import { NavIconSvg, type NavIcon } from "@/components/nav/nav-icons";

/**
 * A card that stays folded until tapped, for things people need now and
 * then rather than every visit. Plain <details>, so it works before any
 * script loads and keyboards and screen readers already know it.
 */
export function Disclosure({
  title,
  summary,
  icon,
  defaultOpen = false,
  children,
}: {
  title: string;
  /** One line under the title saying what's inside. */
  summary?: string;
  icon: NavIcon;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  return (
    <details className="group overflow-hidden card" open={defaultOpen}>
      <summary className="flex min-h-16 cursor-pointer list-none items-center gap-3 p-4 transition-colors select-none hover:bg-canvas/40 sm:px-6 [&::-webkit-details-marker]:hidden">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-control bg-canvas">
          <NavIconSvg icon={icon} className="size-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-semibold tracking-tight">{title}</span>
          {summary && (
            <span className="block truncate text-sm text-muted">{summary}</span>
          )}
        </span>
        <NavIconSvg
          icon="chevronDown"
          className="size-5 shrink-0 text-muted transition-transform duration-200 group-open:rotate-180"
        />
      </summary>
      <div className="details-body border-t border-line p-4 sm:p-6">
        {children}
      </div>
    </details>
  );
}
