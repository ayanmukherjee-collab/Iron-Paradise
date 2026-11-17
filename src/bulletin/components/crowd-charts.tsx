// Static SVG pictures of the crowd meter: the Quiet / Moderate / Busy bar
// and the curve of how long a check-in counts. No hooks, so they render on
// the server (Settings) and in the browser (the Home card) alike.

/** Where Quiet ends and Busy starts, as shares of comfortable capacity. */
export const ZONES = [
  { name: "Quiet", from: 0, to: 0.3 },
  { name: "Moderate", from: 0.3, to: 0.7 },
  { name: "Busy", from: 0.7, to: 1 },
] as const;

const GAP = 1; // % between zones

/** As a legend (Settings), the zones shade from light to dark. */
const LEGEND_FILL = ["fill-ink/15", "fill-ink/45", "fill-ink"];

/**
 * One bar in three zones, filled up to `share` (0–1). With `capacity`, the
 * zone names sit underneath, with the people counts where they change.
 */
export function CrowdZones({
  share,
  label,
  capacity,
  className = "",
}: {
  share: number;
  label: string;
  /** Shows names and the 30% / 70% people counts under the bar. */
  capacity?: number;
  className?: string;
}) {
  const filled = Math.max(0, Math.min(1, share));
  return (
    <div className={className}>
      <svg
        role="img"
        aria-label={label}
        width="100%"
        height="10"
        className="block overflow-visible"
      >
        {ZONES.map((zone, i) => {
          const start = zone.from * 100 + (i > 0 ? GAP / 2 : 0);
          const end = zone.to * 100 - (i < ZONES.length - 1 ? GAP / 2 : 0);
          const part = Math.max(
            0,
            Math.min(1, (filled - zone.from) / (zone.to - zone.from)),
          );
          return (
            <g key={zone.name}>
              <rect
                x={`${start}%`}
                width={`${end - start}%`}
                height="10"
                rx="5"
                className={
                  capacity === undefined ? "fill-ink/[0.07]" : LEGEND_FILL[i]
                }
              />
              {part > 0 && (
                <rect
                  x={`${start}%`}
                  width={`${(end - start) * part}%`}
                  height="10"
                  rx="5"
                  className="fill-ink transition-[width] duration-700"
                />
              )}
            </g>
          );
        })}
      </svg>
      {capacity !== undefined && (
        <div
          aria-hidden="true"
          className="mt-1.5 grid grid-cols-[30fr_40fr_30fr] text-xs text-muted tabular-nums"
        >
          <span>Quiet</span>
          <span className="relative text-center">
            <span className="absolute left-0 -translate-x-1/2">
              {Math.round(capacity * 0.3)}
            </span>
            Moderate
            <span className="absolute right-0 translate-x-1/2">
              {Math.round(capacity * 0.7)}
            </span>
          </span>
          <span className="text-right">Busy</span>
        </div>
      )}
    </div>
  );
}

/**
 * How much one check-in counts over time: fully until `full` minutes, then
 * fading to nothing at `gone`.
 */
export function FadeCurve({
  full,
  gone,
  className = "",
}: {
  full: number;
  gone: number;
  className?: string;
}) {
  const width = 240;
  const left = 4;
  const right = width - 4;
  const top = 6;
  const bottom = 54;
  const span = gone * 1.1;
  const x = (minutes: number) => left + (minutes / span) * (right - left);
  const line = `${x(0)},${top} ${x(full)},${top} ${x(gone)},${bottom}`;
  return (
    <svg
      role="img"
      aria-label={`A check-in counts fully for ${full} minutes, then fades out by ${gone} minutes`}
      viewBox={`0 0 ${width} 72`}
      className={`block w-full ${className}`}
    >
      <polygon
        points={`${x(0)},${bottom} ${line}`}
        className="fill-ink/[0.07]"
      />
      <line
        x1={left}
        x2={right}
        y1={bottom}
        y2={bottom}
        strokeWidth="1"
        className="stroke-line"
      />
      <line
        x1={x(full)}
        x2={x(full)}
        y1={top}
        y2={bottom}
        strokeWidth="1"
        strokeDasharray="2 3"
        className="stroke-ink/40"
      />
      <polyline
        points={line}
        fill="none"
        strokeWidth="2.5"
        strokeLinejoin="round"
        strokeLinecap="round"
        className="stroke-ink"
      />
      <g className="fill-muted text-[10px] tabular-nums">
        <text x={x(0)} y="68">
          0
        </text>
        <text x={x(full)} y="68" textAnchor="middle">
          {full}
        </text>
        <text x={x(gone)} y="68" textAnchor="middle">
          {gone} min
        </text>
      </g>
    </svg>
  );
}
