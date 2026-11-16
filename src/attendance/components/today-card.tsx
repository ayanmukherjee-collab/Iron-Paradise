import {
  batchHours,
  batchLabels,
  type Batch,
  type Batches,
} from "@/attendance/batches";
import { NavIconSvg } from "@/components/nav/nav-icons";
import Link from "@/components/ui/link";
import { Dial, Meter } from "@/components/ui/viz";

/**
 * Today at the gym as one dark card: a ring of who's in out of everyone
 * current, and a bar per batch. Shared by Home and Attendance.
 */
export function TodayCard({
  inToday,
  current,
  morning,
  evening,
  batches,
  openNow,
  href,
  className = "",
}: {
  inToday: number;
  current: number;
  morning: number;
  evening: number;
  batches: Batches;
  openNow: Batch | null;
  /** Makes the ring a link, e.g. to the attendance page. */
  href?: string;
  className?: string;
}) {
  const dial = (
    <Dial
      value={inToday}
      max={current}
      size={128}
      stroke={10}
      tone="dark"
      label={`${inToday} of ${current} members in today`}
    >
      <span className="flex flex-col items-center">
        <span className="text-4xl font-semibold tracking-tight tabular-nums">
          {inToday}
        </span>
        <span className="mt-1 text-xs text-white/55 tabular-nums">
          / {current}
        </span>
      </span>
    </Dial>
  );

  return (
    <section
      aria-label="Today"
      className={`flex flex-col card-dark p-5 sm:p-6 ${className}`}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-2 text-sm font-medium">
          <NavIconSvg icon="attendance" className="size-4" />
          Today
        </span>
        <span
          className={`inline-flex items-center gap-1.5 rounded-badge px-2 py-1 text-xs font-medium ${openNow ? "bg-white text-ink" : "bg-white/10 text-white/60"}`}
        >
          <span
            className={`size-1.5 rounded-full ${openNow ? "bg-ink motion-safe:animate-pulse" : "bg-white/40"}`}
          />
          {openNow ? batchLabels[openNow] : "Closed"}
        </span>
      </div>

      <div className="mt-5 flex flex-1 items-center gap-5 sm:gap-7">
        {href ? (
          <Link
            href={href}
            className="rounded-full transition-opacity hover:opacity-85"
          >
            {dial}
          </Link>
        ) : (
          dial
        )}
        <div className="min-w-0 flex-1 space-y-4">
          <BatchBar
            icon="sun"
            label={batchLabels.morning}
            hours={batchHours(batches, "morning")}
            value={morning}
            max={Math.max(morning, evening, 1)}
            open={openNow === "morning"}
          />
          <BatchBar
            icon="moon"
            label={batchLabels.evening}
            hours={batchHours(batches, "evening")}
            value={evening}
            max={Math.max(morning, evening, 1)}
            open={openNow === "evening"}
          />
        </div>
      </div>
    </section>
  );
}

function BatchBar({
  icon,
  label,
  hours,
  value,
  max,
  open,
}: {
  icon: "sun" | "moon";
  label: string;
  hours: string;
  value: number;
  max: number;
  open: boolean;
}) {
  return (
    <div title={`${label} · ${hours}`}>
      <div className="flex items-center justify-between gap-2 text-sm">
        <span
          className={`flex items-center gap-1.5 ${open ? "text-white" : "text-white/60"}`}
        >
          <NavIconSvg icon={icon} className="size-4" />
          <span className="sr-only">{label}</span>
          <span className="truncate text-xs" aria-hidden="true">
            {hours}
          </span>
        </span>
        <span className="font-semibold tabular-nums">{value}</span>
      </div>
      <Meter
        value={value}
        max={max}
        tone="dark"
        label={`${label}: ${value}`}
        className="mt-1.5"
      />
    </div>
  );
}
