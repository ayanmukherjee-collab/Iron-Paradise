"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { NavIconSvg, type NavIcon } from "@/components/nav/nav-icons";

/**
 * A button that opens a small panel of choices underneath it. Closes on a
 * choice, on Escape, or on a tap anywhere else. The panel lines up with the
 * button's right edge, so it stays on screen for buttons at the end of a row.
 */
export function Menu({
  label,
  icon,
  badge,
  children,
}: {
  label: string;
  icon: NavIcon;
  /** A short note shown after the label, such as the current choice. */
  badge?: string;
  children: (close: () => void) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={root} className="relative shrink-0">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
        className={`btn-chip min-h-12 ${open ? "bg-ink text-white ring-ink" : ""}`}
      >
        <NavIconSvg icon={icon} className="size-[1.1rem]" />
        {label}
        {badge && (
          <span
            className={`hidden text-xs sm:inline ${open ? "text-white/60" : "text-muted"}`}
          >
            {badge}
          </span>
        )}
      </button>
      {open && (
        <div
          id={panelId}
          className="absolute top-full right-0 z-30 mt-2 w-64 origin-top-right rounded-tile bg-white p-1.5 shadow-float ring-1 ring-line motion-safe:animate-rise"
        >
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}

/** A heading inside a menu panel. */
export function MenuHeading({ children }: { children: ReactNode }) {
  return (
    <p className="px-3 pt-2 pb-1 text-xs font-medium text-muted">{children}</p>
  );
}

const itemClass =
  "flex min-h-11 w-full items-center gap-3 rounded-control px-3 text-left text-sm font-medium transition-colors hover:bg-canvas";

/** A choice in a menu; a tick marks the one in use. */
export function MenuOption({
  selected,
  onSelect,
  children,
}: {
  selected: boolean;
  onSelect: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      className={itemClass}
    >
      <span className="flex-1">{children}</span>
      {selected && <NavIconSvg icon="check" className="size-4" />}
    </button>
  );
}

/** A link in a menu, with an optional line of detail under it. */
export function MenuLink({
  href,
  icon,
  detail,
  onSelect,
  children,
}: {
  href: string;
  icon: NavIcon;
  detail?: string;
  onSelect?: () => void;
  children: ReactNode;
}) {
  return (
    <a href={href} onClick={onSelect} className={`${itemClass} py-2`}>
      <span className="flex size-8 shrink-0 items-center justify-center rounded-badge bg-canvas">
        <NavIconSvg icon={icon} className="size-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block">{children}</span>
        {detail && (
          <span className="block text-xs font-normal text-muted">{detail}</span>
        )}
      </span>
    </a>
  );
}
