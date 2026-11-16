import type { ReactNode } from "react";
import {
  facilities,
  hours,
  planEnquiry,
  plans,
  type HoursRow,
  type Plan,
} from "@/content/landing";
import { DAY_SHORT, type GymNow, type OpenStatus } from "../open-status";
import { StatusChip } from "./hero";
import { Icon, type LandingIcon } from "./icons";

/** A section's title: an icon tile first, then the word. */
export function SectionTitle({
  id,
  icon,
  children,
  aside,
}: {
  id: string;
  icon: LandingIcon;
  children: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 id={id} className="flex items-center gap-3">
        <span className="landing-icon size-11">
          <Icon name={icon} className="size-6" />
        </span>
        <span className="text-2xl font-semibold tracking-[-0.025em] md:text-[1.75rem]">
          {children}
        </span>
      </h2>
      {aside}
    </div>
  );
}

export function Facilities() {
  return (
    <section
      id="gym"
      aria-labelledby="gym-title"
      className="panel-grid scroll-mt-4 landing-panel p-5 md:p-7"
    >
      <SectionTitle id="gym-title" icon="dumbbell">
        {facilities.heading}
      </SectionTitle>
      <ul className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {facilities.items.map((item) => (
          <li
            key={item.name}
            className="flex aspect-[5/4] flex-col justify-between landing-tile p-4 sm:aspect-square"
          >
            <span className="landing-icon size-16">
              <Icon name={item.icon} className="size-10" strokeWidth={1.5} />
            </span>
            <span className="text-lg leading-tight font-semibold">
              {item.name}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

const DAY_MARKS = [0, 6, 12, 18, 24];
const DAY_LABELS = ["12 AM", "6 AM", "12 PM", "6 PM", "12 AM"];

/** A day as 24 blocks: lit when the gym is open, an orange mark at "now". */
function DayStrip({ rows, hour }: { rows: HoursRow[]; hour: number }) {
  const isOpen = (h: number) => rows.some((row) => h >= row.from && h < row.to);
  return (
    <div aria-hidden className="relative pt-12">
      {rows.map((row) => (
        <span
          key={row.label}
          className="absolute top-0 -translate-x-1/2 text-white"
          style={{ left: `${((row.from + row.to) / 2 / 24) * 100}%` }}
        >
          <Icon name={row.icon} className="size-8" />
        </span>
      ))}
      <div className="relative grid grid-cols-[repeat(24,minmax(0,1fr))] gap-[3px]">
        {Array.from({ length: 24 }, (_, h) => (
          <span
            key={h}
            className={`h-12 rounded-[0.25rem] ${isOpen(h) ? "bg-white" : "bg-white/[0.08]"}`}
          />
        ))}
        <span
          className="absolute -top-2 -bottom-2 w-1 -translate-x-1/2 rounded-full bg-blaze ring-4 ring-charcoal"
          style={{ left: `${(hour / 24) * 100}%` }}
        />
      </div>
      <div className="relative mt-2 h-5 text-xs font-medium text-smoke">
        {DAY_MARKS.map((mark, i) => (
          <span
            key={i}
            className={`absolute whitespace-nowrap ${i === 0 ? "" : i === DAY_MARKS.length - 1 ? "-translate-x-full" : "-translate-x-1/2"}`}
            style={{ left: `${(mark / 24) * 100}%` }}
          >
            {DAY_LABELS[i]}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Monday first, as the week is said out loud. */
const WEEK = [1, 2, 3, 4, 5, 6, 0];
const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

/** Seven day tiles: lit when open, crossed out when shut, today ringed. */
function WeekRow({ today }: { today: number }) {
  return (
    <ul aria-label="Days open" className="grid grid-cols-7 gap-1.5 sm:gap-2">
      {WEEK.map((day) => {
        const closed = hours.closedDays.includes(day);
        const isToday = day === today;
        return (
          <li
            key={day}
            className={`flex flex-col items-center gap-1.5 rounded-tile py-2.5 text-xs font-semibold sm:text-sm ${
              closed
                ? "bg-transparent text-smoke ring-1 ring-white/10 ring-inset"
                : "bg-white/[0.08] text-white"
            } ${isToday ? "outline-2 outline-offset-2 outline-blaze" : ""}`}
          >
            <span aria-hidden>{DAY_SHORT[day]}</span>
            <span className="sr-only">
              {`${DAY_NAMES[day]}: ${closed ? "closed" : "open"}${isToday ? " (today)" : ""}`}
            </span>
            <Icon
              name={closed ? "closed" : "check"}
              className="size-5"
              strokeWidth={2}
            />
          </li>
        );
      })}
    </ul>
  );
}

export function Hours({ status, now }: { status: OpenStatus; now: GymNow }) {
  return (
    <section
      id="time"
      aria-labelledby="time-title"
      className="panel-hatch scroll-mt-4 landing-panel p-5 md:p-7"
    >
      <SectionTitle
        id="time-title"
        icon="clock"
        aside={<StatusChip status={status} />}
      >
        {hours.heading}
      </SectionTitle>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.4fr_1fr] lg:items-end">
        <DayStrip rows={hours.rows} hour={now.hour} />
        <ul className="grid grid-cols-2 gap-3">
          {hours.rows.map((row) => (
            <li
              key={row.label}
              className="flex flex-col gap-4 landing-tile p-4"
            >
              <span className="flex items-center gap-2.5">
                <span className="landing-icon size-11">
                  <Icon name={row.icon} className="size-6" />
                </span>
                <span className="font-semibold text-mist">{row.label}</span>
              </span>
              <span className="display text-[clamp(2rem,8vw,2.75rem)] tabular-nums">
                {row.slot}
              </span>
            </li>
          ))}
        </ul>
      </div>
      <div className="mt-6">
        <WeekRow today={now.day} />
        <p className="mt-3 flex items-center gap-2 text-sm font-medium text-mist">
          <Icon name="calendar" className="size-[1.125rem]" />
          {hours.sub}
        </p>
      </div>
    </section>
  );
}

/** Plan lengths as big numbers. No prices online: each one opens WhatsApp. */
export function Plans() {
  return (
    <section
      id="plans"
      aria-labelledby="plans-title"
      className="panel-dots scroll-mt-4 landing-panel p-5 md:p-7"
    >
      <SectionTitle id="plans-title" icon="calendar">
        {plans.heading}
      </SectionTitle>
      <p className="mt-3 max-w-md text-mist">{plans.sub}</p>

      <ul
        aria-label="Membership plans"
        className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4"
      >
        {plans.items.map((plan) => (
          <PlanTile key={plan.name} plan={plan} />
        ))}
      </ul>

      <p className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm font-medium text-mist">
        <span className="inline-flex gap-1.5 text-white">
          <span className="landing-icon size-9">
            <Icon name="cash" className="size-5" />
          </span>
          <span className="landing-icon size-9">
            <Icon name="upi" className="size-5" />
          </span>
        </span>
        {plans.footnote}
      </p>
    </section>
  );
}

function PlanTile({ plan }: { plan: Plan }) {
  const featured = plan.featured ?? false;
  return (
    <li>
      <a
        href={planEnquiry(plan)}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`${plan.name} plan, ${plan.months} ${plan.months === 1 ? "month" : "months"}. Ask on WhatsApp`}
        className={`flex h-full flex-col rounded-card p-4 ring-1 transition-[background-color,transform] duration-150 active:scale-[0.98] ${
          featured
            ? "bg-white text-ink ring-white hover:bg-paper"
            : "bg-graphite ring-white/[0.06] hover:bg-ash"
        }`}
      >
        <span className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1.5">
          <span className="text-sm font-semibold">{plan.name}</span>
          {featured && (
            <span className="rounded-badge bg-blaze px-2 py-0.5 text-xs font-bold whitespace-nowrap text-white">
              {plan.note}
            </span>
          )}
        </span>
        <span className="mt-3 flex items-baseline gap-2">
          <span className="display text-[clamp(4rem,18vw,5.5rem)] tabular-nums">
            {plan.months}
          </span>
          <span className="text-sm font-semibold uppercase">
            {plan.months === 1 ? "month" : "months"}
          </span>
        </span>
        {!featured && <span className="text-sm text-smoke">{plan.note}</span>}
        <span
          className={`mt-auto inline-flex min-h-10 items-center gap-2 self-start rounded-control px-3 pt-0 text-sm font-semibold ${
            featured ? "mt-4 bg-ink text-white" : "mt-4 bg-white/[0.08]"
          }`}
        >
          <Icon name="whatsapp" className="size-[1.125rem]" />
          Ask
        </span>
      </a>
    </li>
  );
}
