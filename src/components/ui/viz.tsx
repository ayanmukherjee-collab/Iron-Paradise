// Small charts for the signed-in app: rings, bars and stat cards. The app
// shows numbers as shapes first and words second, so these are used on
// every page that sums something up. Plain SVG and divs, server-rendered.
import type { ReactNode } from "react";
import Link from "@/components/ui/link";
import { NavIconSvg, type NavIcon } from "@/components/nav/nav-icons";

type Tone = "light" | "dark";

function share(value: number, max: number): number {
  if (max <= 0) return 0;
  return Math.max(0, Math.min(1, value / max));
}

/** A progress ring with anything in its middle. */
export function Dial({
  value,
  max,
  size = 64,
  stroke = 6,
  tone = "light",
  label,
  children,
}: {
  value: number;
  max: number;
  size?: number;
  stroke?: number;
  tone?: Tone;
  /** What the ring shows, for screen readers. */
  label: string;
  children?: ReactNode;
}) {
  const part = share(value, max);
  const radius = (size - stroke) / 2;
  // A sliver stays visible for any value above zero.
  const shown = part > 0 ? Math.max(part, 0.03) : 0;
  return (
    <span
      role="img"
      aria-label={label}
      className="relative inline-flex shrink-0 items-center justify-center"
      style={{ width: size, height: size }}
    >
      <svg
        viewBox={`0 0 ${size} ${size}`}
        className="absolute inset-0 -rotate-90"
        aria-hidden="true"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          className={tone === "dark" ? "stroke-white/12" : "stroke-ink/[0.07]"}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          pathLength={100}
          strokeDasharray={`${shown * 100} 100`}
          className={`draw-ring ${tone === "dark" ? "stroke-white" : "stroke-ink"}`}
        />
      </svg>
      <span aria-hidden="true" className="relative leading-none">
        {children}
      </span>
    </span>
  );
}

/** A thin horizontal bar filled to a share. */
export function Meter({
  value,
  max,
  tone = "light",
  label,
  className = "",
}: {
  value: number;
  max: number;
  tone?: Tone;
  label: string;
  className?: string;
}) {
  const part = share(value, max);
  return (
    <span
      role="img"
      aria-label={label}
      className={`block h-1.5 overflow-hidden rounded-full ${tone === "dark" ? "bg-white/12" : "bg-ink/[0.07]"} ${className}`}
    >
      <span
        className={`grow-x block h-full rounded-full ${tone === "dark" ? "bg-white" : "bg-ink"}`}
        style={{ width: `${part > 0 ? Math.max(part * 100, 3) : 0}%` }}
      />
    </span>
  );
}

export interface Segment {
  key: string;
  value: number;
  /** Fill class, e.g. "bg-ink" or "bg-ink/40". */
  fill: string;
  label: string;
}

/** One bar split into parts, with a dot legend underneath. */
export function SegmentBar({
  segments,
  tone = "light",
  legend = true,
}: {
  segments: Segment[];
  tone?: Tone;
  legend?: boolean;
}) {
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);
  const visible = segments.filter((segment) => segment.value > 0);
  return (
    <div>
      <span
        role="img"
        aria-label={segments
          .map((segment) => `${segment.label} ${segment.value}`)
          .join(", ")}
        className={`flex h-2 gap-0.5 overflow-hidden rounded-full ${tone === "dark" ? "bg-white/12" : "bg-ink/[0.07]"}`}
      >
        {total > 0 &&
          visible.map((segment) => (
            <span
              key={segment.key}
              className={`grow-x block h-full first:rounded-l-full last:rounded-r-full ${segment.fill}`}
              style={{ width: `${(segment.value / total) * 100}%` }}
            />
          ))}
      </span>
      {legend && (
        <ul
          aria-hidden="true"
          className={`mt-2.5 flex flex-wrap gap-x-3 gap-y-1 text-xs ${tone === "dark" ? "text-white/60" : "text-muted"}`}
        >
          {segments.map((segment) => (
            <li key={segment.key} className="flex items-center gap-1.5">
              <span className={`size-2 rounded-full ${segment.fill}`} />
              {segment.label}
              <span
                className={`font-semibold tabular-nums ${tone === "dark" ? "text-white" : "text-ink"}`}
              >
                {segment.value}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Tiny column chart, e.g. visits per day across a month. */
export function Columns({
  values,
  highlight,
  label,
  tone = "light",
  className = "h-16",
}: {
  values: number[];
  /** Index drawn solid (today, say); the rest are lighter. */
  highlight?: number;
  label: string;
  tone?: Tone;
  className?: string;
}) {
  const top = Math.max(1, ...values);
  return (
    <span
      role="img"
      aria-label={label}
      className={`flex items-end gap-[2px] ${className}`}
    >
      {values.map((value, index) => (
        <span
          key={index}
          className={`grow-y min-h-[3px] flex-1 rounded-[2px] ${
            index === highlight
              ? tone === "dark"
                ? "bg-white"
                : "bg-ink"
              : value > 0
                ? tone === "dark"
                  ? "bg-white/45"
                  : "bg-ink/35"
                : tone === "dark"
                  ? "bg-white/10"
                  : "bg-ink/[0.07]"
          }`}
          style={{
            height: `${(value / top) * 100}%`,
            transitionDelay: `${index * 12}ms`,
          }}
        />
      ))}
    </span>
  );
}

/**
 * One figure in a card: an icon, the number, a one-word label, and
 * optionally a ring or bar. Turns black when it needs someone to act.
 */
export function StatCard({
  href,
  icon,
  label,
  figure,
  lit = false,
  visual,
  aside,
  className = "",
}: {
  href?: string;
  icon: NavIcon;
  label: string;
  figure: ReactNode;
  /** Black card, for figures that need attention. */
  lit?: boolean;
  /** A Meter or similar under the figure. */
  visual?: (tone: Tone) => ReactNode;
  /** A Dial or similar at the right of the figure. */
  aside?: (tone: Tone) => ReactNode;
  className?: string;
}) {
  const tone: Tone = lit ? "dark" : "light";
  const body = (
    <>
      <span className="flex items-center justify-between gap-2">
        <span
          className={`flex size-8 items-center justify-center rounded-control ${lit ? "bg-white/12" : "bg-canvas"}`}
        >
          <NavIconSvg icon={icon} className="size-4" />
        </span>
        {href && (
          <NavIconSvg
            icon="arrow"
            className={`size-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 ${lit ? "text-white/50" : "text-muted"}`}
          />
        )}
      </span>
      <span className="mt-3 flex items-end justify-between gap-2">
        <span className="min-w-0">
          <span className="block truncate text-2xl font-semibold tracking-tight tabular-nums sm:text-3xl">
            {figure}
          </span>
          <span
            className={`block truncate text-xs ${lit ? "text-white/60" : "text-muted"}`}
          >
            {label}
          </span>
        </span>
        {aside?.(tone)}
      </span>
      {visual && <span className="mt-3 block">{visual(tone)}</span>}
    </>
  );
  const shell = `group flex h-full flex-col rounded-card p-4 transition-[box-shadow,background-color] sm:p-5 ${
    lit ? "bg-ink text-white shadow-float" : "bg-white shadow-card"
  } ${className}`;
  return href ? (
    <Link href={href} className={`${shell} hover:shadow-float`}>
      {body}
    </Link>
  ) : (
    <div className={shell}>{body}</div>
  );
}

/** Square icon-only control, used where a word would only repeat the icon. */
export const iconButton =
  "inline-flex size-11 shrink-0 items-center justify-center rounded-control transition-[background-color,color,transform] duration-150 active:scale-95";
