"use client";

import { useId, useState, type ReactNode } from "react";

export interface Tab {
  id: string;
  label: string;
  content: ReactNode;
}

/**
 * A row of choices where only the chosen one's content shows. The panels
 * are rendered on the server and handed in, so switching is instant.
 */
export function Tabs({ tabs, label }: { tabs: Tab[]; label: string }) {
  const [current, setCurrent] = useState(tabs[0]?.id);
  const baseId = useId();

  return (
    <div>
      <div
        role="tablist"
        aria-label={label}
        className="grid gap-1 rounded-control bg-canvas p-1"
        style={{
          gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))`,
        }}
      >
        {tabs.map((tab) => {
          const selected = tab.id === current;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              id={`${baseId}-${tab.id}-tab`}
              aria-selected={selected}
              aria-controls={`${baseId}-${tab.id}`}
              onClick={() => setCurrent(tab.id)}
              className={`min-h-10 truncate rounded-badge px-2 text-sm font-medium transition-colors ${
                selected
                  ? "bg-white text-ink shadow-card"
                  : "text-muted hover:text-ink"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
      {tabs.map((tab) => (
        <div
          key={tab.id}
          role="tabpanel"
          id={`${baseId}-${tab.id}`}
          aria-labelledby={`${baseId}-${tab.id}-tab`}
          hidden={tab.id !== current}
          className="pt-5 motion-safe:animate-fade"
        >
          {tab.content}
        </div>
      ))}
    </div>
  );
}
