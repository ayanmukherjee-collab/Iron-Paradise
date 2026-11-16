import type { ReactNode } from "react";

export interface StatusFigure {
  label: string;
  value: string;
  note?: string;
}

/**
 * One card that sums up a page: a title line and a row of figures split by
 * hairlines. Used where several separate tiles would compete for attention.
 */
export function StatusCard({
  title,
  aside,
  figures,
}: {
  title: string;
  /** Small text at the right of the title, like a date. */
  aside?: ReactNode;
  figures: StatusFigure[];
}) {
  return (
    <section className="card p-4 sm:p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-medium text-muted">{title}</h2>
        {aside && <span className="text-xs text-muted">{aside}</span>}
      </div>
      <dl
        className="mt-3 grid divide-x divide-line"
        style={{
          gridTemplateColumns: `repeat(${figures.length}, minmax(0, 1fr))`,
        }}
      >
        {figures.map((figure) => (
          <div
            key={figure.label}
            className="flex min-w-0 flex-col px-3 first:pl-0 last:pr-0 sm:px-5"
          >
            <dt className="order-2 text-xs leading-snug text-muted">
              {figure.label}
            </dt>
            <dd className="order-1 truncate text-xl font-semibold tracking-tight tabular-nums sm:text-2xl">
              {figure.value}
            </dd>
            {figure.note && (
              <dd className="order-3 truncate text-xs text-muted">
                {figure.note}
              </dd>
            )}
          </div>
        ))}
      </dl>
    </section>
  );
}
