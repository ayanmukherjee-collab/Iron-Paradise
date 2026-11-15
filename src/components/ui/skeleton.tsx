// Placeholders shown by loading.tsx files while a page's data is on its way,
// so a tap on a tab answers at once instead of leaving the old page frozen.
// Shapes only, no fake text; the pulse stops for people who prefer less motion.

export function Bar({ className = "" }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`block bg-mist/60 motion-safe:animate-pulse ${className}`}
    />
  );
}

/** Announces the wait to screen readers once, for the whole placeholder. */
export function LoadingRegion({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <section aria-busy="true" aria-live="polite">
      <span className="sr-only">{label}</span>
      {children}
    </section>
  );
}

export function TitleBar({ action = false }: { action?: boolean }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <Bar className="h-12 w-56" />
      {action && <Bar className="h-12 w-36" />}
    </div>
  );
}

export function RowList({ rows = 6 }: { rows?: number }) {
  return (
    <ul className="mt-6 border-t-2 border-ink">
      {Array.from({ length: rows }, (_, index) => (
        <li key={index} className="border-b-2 border-ink py-4">
          <div className="flex items-center justify-between gap-4">
            <Bar className="h-6 w-48" />
            <Bar className="h-6 w-20" />
          </div>
          <Bar className="mt-2 h-4 w-64 max-w-full" />
        </li>
      ))}
    </ul>
  );
}
