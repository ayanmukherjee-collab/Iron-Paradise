// A member's visits as pictures: three figures, a calendar grid of the last
// thirteen weeks and a bar per week. Plain SVG rendered on the server, so
// the phone gets finished drawings and no chart script.
import {
  averagePerWeek,
  visitGrid,
  visitsThisMonth,
  weekStreak,
  weeklyVisits,
  type GridDay,
  type WeekCount,
} from "@/attendance/visit-stats";
import { NavIconSvg } from "@/components/nav/nav-icons";
import type { IsoDate } from "@/lib/dates";

const months = "Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec".split(" ");
const monthOf = (date: IsoDate) => months[Number(date.slice(5, 7)) - 1];

export function VisitCharts({
  visits,
  today,
  footnote,
}: {
  /** Gym dates with a visit, any order. */
  visits: IsoDate[];
  today: IsoDate;
  /** One quiet line under the charts, e.g. visits from earlier years. */
  footnote?: string;
}) {
  const grid = visitGrid(visits, today);
  const weeks = weeklyVisits(visits, today);
  const streak = weekStreak(weeks);
  const average = averagePerWeek(weeks);
  const month = visitsThisMonth(visits, today);

  return (
    <section aria-label="Attendance" className="card p-5 sm:p-6">
      <h2 className="flex items-center gap-2 font-semibold tracking-tight">
        <NavIconSvg icon="attendance" className="size-5" />
        Attendance
      </h2>

      <dl className="mt-4 grid grid-cols-3 gap-2">
        <Figure label="This month" value={String(month)} dark />
        <Figure label="Week streak" value={String(streak)} />
        <Figure label="Per week" value={average.toFixed(1)} />
      </dl>

      <VisitGrid grid={grid} />
      <WeeklyBars weeks={weeks} average={average} />
      {footnote && (
        <p className="mt-4 border-t border-line pt-4 text-sm text-muted">
          {footnote}
        </p>
      )}
    </section>
  );
}

function Figure({
  label,
  value,
  dark = false,
}: {
  label: string;
  value: string;
  dark?: boolean;
}) {
  return (
    <div
      className={`rounded-tile p-3 ${dark ? "bg-ink text-white" : "bg-canvas"}`}
    >
      <dt className={`text-xs ${dark ? "text-white/60" : "text-muted"}`}>
        {label}
      </dt>
      <dd className="mt-1 text-2xl font-semibold tracking-tight tabular-nums">
        {value}
      </dd>
    </div>
  );
}

const cell = 16;
const gap = 4;
const step = cell + gap;
// Both charts leave the same margin on each side, so the squares sit in the
// middle of the card and each week's bar lines up under its column. The
// margin also holds the day letters and today's ring, which is drawn a
// little outside its square.
const gridLeft = 18;
const gridTop = 16;
const ringPad = 3;
const chartWidth = (columns: number) => gridLeft * 2 + columns * step - gap;

/** One square per day: filled for a visit, ringed for today. */
function VisitGrid({ grid }: { grid: GridDay[][] }) {
  const width = chartWidth(grid.length);
  const height = gridTop + 7 * step - gap + ringPad;
  const visited = grid.flat().filter((day) => day.visited).length;
  // A month's name over the first week that starts in it.
  const monthLabels = grid.flatMap((week, i) => {
    const first = week[0].date;
    const previous = grid[i - 1]?.[0].date;
    return !previous || monthOf(first) !== monthOf(previous)
      ? [{ x: gridLeft + i * step, label: monthOf(first) }]
      : [];
  });

  return (
    <figure className="mt-6">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full"
        role="img"
        aria-label={`${visited} visits in the last ${grid.length} weeks`}
      >
        {monthLabels.map(({ x, label }) => (
          <text
            key={`${x}-${label}`}
            x={x}
            y={10}
            className="fill-muted text-[9px] font-medium"
          >
            {label}
          </text>
        ))}
        {["M", "W", "F"].map((day, i) => (
          <text
            key={day}
            x={0}
            y={gridTop + i * 2 * step + cell - 4}
            className="fill-muted text-[9px] font-medium"
          >
            {day}
          </text>
        ))}
        {grid.map((week, column) =>
          week.map((day, row) => (
            <rect
              key={day.date}
              x={gridLeft + column * step}
              y={gridTop + row * step}
              width={cell}
              height={cell}
              rx={4}
              style={
                day.visited
                  ? { transitionDelay: `${column * 30}ms` }
                  : undefined
              }
              className={
                day.visited
                  ? "pop-in fill-ink"
                  : day.future
                    ? "fill-transparent stroke-ink/10"
                    : "fill-ink/[0.07]"
              }
              strokeDasharray={day.future && !day.visited ? "2 2" : undefined}
            >
              <title>{`${day.date}${day.visited ? " · visited" : ""}`}</title>
            </rect>
          )),
        )}
        {grid
          .flat()
          .map((day, i) =>
            day.isToday ? (
              <rect
                key="today"
                x={gridLeft + Math.floor(i / 7) * step - 2}
                y={gridTop + (i % 7) * step - 2}
                width={cell + 4}
                height={cell + 4}
                rx={6}
                className="fill-none stroke-blaze"
                strokeWidth={2}
              />
            ) : null,
          )}
      </svg>
      <figcaption className="mt-2 flex items-center justify-center gap-3 text-xs text-muted">
        <Key className="bg-ink/[0.07]" label="Missed" />
        <Key className="bg-ink" label="Visited" />
        <Key className="ring-2 ring-blaze ring-inset" label="Today" />
      </figcaption>
    </figure>
  );
}

function Key({ className, label }: { className: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span
        aria-hidden="true"
        className={`size-3 rounded-[3px] ${className}`}
      />
      {label}
    </span>
  );
}

const barsHeight = 96;
const barsTop = 14;
const barsBottom = 16;

/** Visits each week; this week, not over yet, is hatched. */
function WeeklyBars({
  weeks,
  average,
}: {
  weeks: WeekCount[];
  average: number;
}) {
  const width = chartWidth(weeks.length);
  const plot = barsHeight - barsTop - barsBottom;
  const top = Math.max(4, ...weeks.map((week) => week.visits));
  const y = (value: number) => barsTop + plot - (value / top) * plot;
  const last = weeks.length - 1;

  return (
    <figure className="mt-6 border-t border-line pt-5">
      <figcaption className="flex items-baseline justify-between text-sm">
        <span className="font-medium">Visits a week</span>
        <span className="text-xs text-muted">Avg {average.toFixed(1)}</span>
      </figcaption>
      <svg
        viewBox={`0 0 ${width} ${barsHeight}`}
        className="mt-2 w-full"
        role="img"
        aria-label={`Visits a week, last ${weeks.length} weeks: ${weeks.map((week) => week.visits).join(", ")}`}
      >
        <defs>
          <pattern
            id="this-week"
            width="4"
            height="4"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(45)"
          >
            <rect width="2" height="4" className="fill-ink" />
          </pattern>
        </defs>
        {average > 0 && (
          <line
            x1={gridLeft}
            x2={width - gridLeft}
            y1={y(average)}
            y2={y(average)}
            className="stroke-ink/30"
            strokeDasharray="3 3"
          />
        )}
        {weeks.map((week, i) => {
          const barTop = y(week.visits);
          const height = barsTop + plot - barTop;
          const x = gridLeft + i * step;
          return (
            <g key={week.start}>
              <rect
                x={x}
                y={barsTop}
                width={cell}
                height={plot}
                rx={4}
                className="fill-ink/[0.05]"
              />
              {week.visits > 0 && (
                <rect
                  x={x}
                  y={barTop}
                  width={cell}
                  height={height}
                  rx={4}
                  fill={i === last ? "url(#this-week)" : undefined}
                  className={`grow-y ${i === last ? "stroke-ink" : "fill-ink"}`}
                  style={{ transitionDelay: `${i * 30}ms` }}
                  strokeWidth={i === last ? 1 : undefined}
                >
                  <title>{`Week of ${week.start}: ${week.visits}`}</title>
                </rect>
              )}
              {(i === last || week.visits === top) && week.visits > 0 && (
                <text
                  x={x + cell / 2}
                  y={barTop - 3}
                  textAnchor="middle"
                  className="fill-ink text-[9px] font-semibold"
                >
                  {week.visits}
                </text>
              )}
              {i % 4 === 0 || i === last ? (
                <text
                  x={x + cell / 2}
                  y={barsHeight - 3}
                  textAnchor="middle"
                  className="fill-muted text-[8px]"
                >
                  {i === last
                    ? "Now"
                    : `${Number(week.start.slice(8))} ${monthOf(week.start)}`}
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>
    </figure>
  );
}
