"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { NavIconSvg } from "@/components/nav/nav-icons";

/**
 * A modal box over the page: the browser's own <dialog>, so focus, Escape
 * and the backdrop come for free. Tapping outside the box closes it too.
 * `headerExtra` sits next to the close button (an icon action, say).
 */
export function Dialog({
  open,
  onClose,
  title,
  headerExtra,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  headerExtra?: ReactNode;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === ref.current) onClose();
      }}
      className="m-auto max-h-[85dvh] w-[calc(100%-2rem)] max-w-lg overflow-y-auto overscroll-contain rounded-card bg-white p-0 text-ink shadow-float backdrop:bg-ink/40 backdrop:backdrop-blur-[2px]"
    >
      <div className="p-5 sm:p-6">
        <div className="flex items-center gap-2">
          <h2 id={titleId} className="min-w-0 flex-1 section-title">
            {title}
          </h2>
          {headerExtra}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex size-10 shrink-0 items-center justify-center rounded-control text-muted ring-1 ring-line transition-colors hover:bg-ink hover:text-white"
          >
            <NavIconSvg icon="close" className="size-5" />
          </button>
        </div>
        <div className="mt-5">{children}</div>
      </div>
    </dialog>
  );
}
