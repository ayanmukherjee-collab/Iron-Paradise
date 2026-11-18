// Month-by-month charts for the Analytics page: bars (plain or stacked) and
// a line. Plain SVG in the app's black-and-white style, drawn at the card's
// real width so labels stay the same size on a phone and a desktop.
// Hovering, tapping or tabbing to a month shows its figures in the line
// above the chart; with nothing picked, that line shows the latest month.
import {
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { formatMonth, type IsoDate } from "@/lib/dates";

const shortMonths = "Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec".split(
  " ",
);

/** "Dec" for "2025-12-01", with the year on January and the first month. */
function monthTick(month: IsoDate, first: boolean): string {
  const name = shortMonths[Number(month.slice(5, 7)) - 1];
  return first || month.slice(5, 7) === "01"
    ? `${name} ’${month.slice(2, 4)}`
    : name;
}

const monthName = (month: IsoDate) => formatMonth(month.slice(0, 7));

export interface Series {
  key: string;
  label: string;
  /** SVG fill class for the bars. */
  fill: string;
  /** Legend dot class (a background colour). */
  dot: string;
  values: number[];
}

const top = 20;
const bottom = 20;
const height = 168;
const plot = height - top - bottom;

/**
 * The chart's width in pixels, and where each month's column sits. Columns
 * share the width, with a gap of a quarter column between them.
 */
function useColumns(count: number): {
  ref: RefObject<HTMLDivElement | null>;
  width: number;
  column: number;
  slot: number;
  x: (index: number) => number;
} {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(320);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const measure = () => setWidth(Math.max(200, element.clientWidth));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const slot = width / count;
  const column = Math.min(56, slot * 0.76);
  return {
    ref,
    width,
    column,
    slot,
    x: (index) => index * slot + (slot - column) / 2,
  };
}

/**
 * Where a value label goes over the mark spanning `left`–`right`: centred,
 * but kept inside the chart at the first and last months.
 */
function labelAt(
  index: number,
  count: number,
  left: number,
  right: number,
): { x: number; textAnchor: "start" | "middle" | "end" } {
  if (index === 0) return { x: left, textAnchor: "start" };
  if (index === count - 1) return { x: right, textAnchor: "end" };
  return { x: (left + right) / 2, textAnchor: "middle" };
}

/** Which month the readout shows: the picked one, else the latest. */
function usePicked(count: number) {
  const [picked, setPicked] = useState<number | null>(null);
  const shown = picked ?? count - 1;
  const handlers = (index: number) => ({
    onMouseEnter: () => setPicked(index),
    onFocus: () => setPicked(index),
    onClick: () => setPicked(index),
  });
  return { shown, handlers, clear: () => setPicked(null) };
}

function Readout({ month, children }: { month: IsoDate; children: ReactNode }) {
  return (
    <p
      aria-live="polite"
      className="mt-1 flex min-h-5 flex-wrap items-baseline gap-x-2 text-sm"
    >
      <span className="text-muted">{monthName(month)}</span>
      {children}
    </p>
  );
}

/** Month names under the columns: every other one when space is tight. */
function Ticks({
  months,
  shown,
  slot,
}: {
  months: IsoDate[];
  shown: number;
  slot: number;
}) {
  const last = months.length - 1;
  const every = slot < 44 ? 2 : 1;
  return months.map((month, i) =>
    (last - i) % every === 0 || i === shown ? (
      <text
        key={month}
        x={i * slot + slot / 2}
        y={height - 5}
        textAnchor="middle"
        className={`text-[10px] ${i === shown ? "fill-ink font-semibold" : "fill-muted"}`}
      >
        {i === last ? "Now" : monthTick(month, i === 0)}
      </text>
    ) : null,
  );
}

/** Invisible full-height targets, wider than the marks, for each month. */
function HitTargets({
  months,
  slot,
  describe,
  handlers,
}: {
  months: IsoDate[];
  slot: number;
  describe: (index: number) => string;
  handlers: (index: number) => object;
}) {
  return months.map((month, i) => (
    <rect
      key={month}
      x={i * slot}
      y={0}
      width={slot}
      height={height}
      fill="transparent"
      tabIndex={0}
      aria-label={describe(i)}
      className="cursor-pointer outline-none"
      {...handlers(i)}
    >
      <title>{describe(i)}</title>
    </rect>
  ));
}

/**
 * A bar a month. With several series the bars stack, first series at the
 * bottom, and a legend names each one.
 */
export function MonthBars({
  title,
  months,
  series,
  format = (value) => value.toLocaleString("en-IN"),
  extra,
  className = "",
}: {
  title: string;
  months: IsoDate[];
  series: Series[];
  format?: (value: number) => string;
  /** More words for the readout, for the shown month. */
  extra?: (index: number) => ReactNode;
  className?: string;
}) {
  const { shown, handlers, clear } = usePicked(months.length);
  const { ref, width, column, slot, x } = useColumns(months.length);
  const totals = months.map((_, i) =>
    series.reduce((sum, s) => sum + s.values[i], 0),
  );
  const max = Math.max(1, ...totals);
  const stacked = series.length > 1;
  const describe = (i: number) =>
    `${monthName(months[i])}: ${format(totals[i])}`;

  return (
    <figure className={`card p-5 sm:p-6 ${className}`} onMouseLeave={clear}>
      <figcaption>
        <h3 className="font-semibold tracking-tight">{title}</h3>
        <Readout month={months[shown]}>
          <span className="font-semibold tabular-nums">
            {format(totals[shown])}
          </span>
          {stacked &&
            series.map((s) => (
              <span key={s.key} className="text-xs text-muted">
                {s.label}{" "}
                <span className="font-medium text-ink tabular-nums">
                  {format(s.values[shown])}
                </span>
              </span>
            ))}
          {extra?.(shown)}
        </Readout>
      </figcaption>
      <div ref={ref} className="mt-3">
        <svg
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          className="block max-w-full"
          role="img"
          aria-label={`${title}, by month: ${months.map((_, i) => describe(i)).join(", ")}`}
        >
          <line
            x1={0}
            x2={width}
            y1={top + plot}
            y2={top + plot}
            className="stroke-ink/15"
          />
          {months.map((month, i) => {
            const active = i === shown;
            // The top-most part with money in it gets the rounded end.
            const lastLayer = series.findLastIndex((s) => s.values[i] > 0);
            let base = top + plot;
            return (
              <g key={month}>
                <rect
                  x={x(i)}
                  y={top}
                  width={column}
                  height={plot}
                  rx={4}
                  className={active ? "fill-ink/[0.06]" : "fill-ink/[0.03]"}
                />
                {series.map((s, layer) => {
                  const value = s.values[i];
                  if (value <= 0) return null;
                  const h = Math.max(2, (value / max) * plot);
                  base -= h;
                  return (
                    <rect
                      key={s.key}
                      x={x(i)}
                      y={base}
                      width={column}
                      height={h}
                      rx={layer === lastLayer ? 4 : 1.5}
                      className={`grow-y ${s.fill} ${stacked ? "stroke-white" : ""}`}
                      strokeWidth={stacked ? 2 : undefined}
                      style={{ transitionDelay: `${i * 25}ms` }}
                    />
                  );
                })}
                {active && totals[i] > 0 && (
                  <text
                    {...labelAt(i, months.length, x(i), x(i) + column)}
                    y={top + plot - (totals[i] / max) * plot - 5}
                    className="fill-ink stroke-white text-[10px] font-semibold"
                    strokeWidth={3}
                    paintOrder="stroke"
                  >
                    {format(totals[i])}
                  </text>
                )}
              </g>
            );
          })}
          <Ticks months={months} shown={shown} slot={slot} />
          <HitTargets
            months={months}
            slot={slot}
            describe={describe}
            handlers={handlers}
          />
        </svg>
      </div>
      {stacked && (
        <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
          {series.map((s) => (
            <li key={s.key} className="flex items-center gap-1.5">
              <span className={`size-2.5 rounded-full ${s.dot}`} />
              {s.label}
              <span className="font-semibold text-ink tabular-nums">
                {format(s.values.reduce((sum, v) => sum + v, 0))}
              </span>
            </li>
          ))}
        </ul>
      )}
    </figure>
  );
}

/** One figure a month joined by a line, for counts that carry over (members). */
export function MonthLine({
  title,
  months,
  values,
  extra,
  className = "",
}: {
  title: string;
  months: IsoDate[];
  values: number[];
  extra?: (index: number) => ReactNode;
  className?: string;
}) {
  const { shown, handlers, clear } = usePicked(months.length);
  const { ref, width, slot } = useColumns(months.length);
  const highest = Math.max(1, ...values);
  const lowest = Math.min(...values);
  // A year that barely moves would draw a flat line on the floor; start the
  // scale below the lowest month instead (and say so), unless numbers are small.
  const floor = lowest > highest * 0.5 ? Math.floor(lowest * 0.8) : 0;
  const y = (value: number) =>
    top + plot - ((value - floor) / Math.max(1, highest - floor)) * plot;
  const cx = (i: number) => i * slot + slot / 2;
  const points = values.map((value, i) => `${cx(i)},${y(value)}`).join(" ");
  const area = `${cx(0)},${top + plot} ${points} ${cx(values.length - 1)},${top + plot}`;
  const describe = (i: number) =>
    `${monthName(months[i])}: ${values[i].toLocaleString("en-IN")}`;

  return (
    <figure className={`card p-5 sm:p-6 ${className}`} onMouseLeave={clear}>
      <figcaption>
        <h3 className="font-semibold tracking-tight">{title}</h3>
        <Readout month={months[shown]}>
          <span className="font-semibold tabular-nums">
            {values[shown].toLocaleString("en-IN")}
          </span>
          {extra?.(shown)}
        </Readout>
      </figcaption>
      <div ref={ref} className="mt-3">
        <svg
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          className="block max-w-full"
          role="img"
          aria-label={`${title}, by month: ${months.map((_, i) => describe(i)).join(", ")}`}
        >
          <line
            x1={0}
            x2={width}
            y1={top + plot}
            y2={top + plot}
            className="stroke-ink/15"
          />
          {floor > 0 && (
            <text x={0} y={top + plot - 5} className="fill-muted text-[9px]">
              from {floor}
            </text>
          )}
          <line
            x1={cx(shown)}
            x2={cx(shown)}
            y1={top}
            y2={top + plot}
            className="stroke-ink/15"
            strokeDasharray="3 3"
          />
          <polygon points={area} className="fill-ink/[0.06]" />
          <polyline
            points={points}
            fill="none"
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
            className="stroke-ink"
          />
          {values.map((value, i) => (
            <circle
              key={months[i]}
              cx={cx(i)}
              cy={y(value)}
              r={i === shown ? 5 : 3.5}
              strokeWidth={2}
              className={
                i === shown ? "fill-ink stroke-white" : "fill-white stroke-ink"
              }
            />
          ))}
          <text
            {...labelAt(shown, months.length, cx(shown) - 5, cx(shown) + 5)}
            y={y(values[shown]) - 10}
            className="fill-ink stroke-white text-[10px] font-semibold"
            strokeWidth={3}
            paintOrder="stroke"
          >
            {values[shown].toLocaleString("en-IN")}
          </text>
          <Ticks months={months} shown={shown} slot={slot} />
          <HitTargets
            months={months}
            slot={slot}
            describe={describe}
            handlers={handlers}
          />
        </svg>
      </div>
    </figure>
  );
}
