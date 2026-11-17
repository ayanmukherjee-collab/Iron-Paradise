import type { Metadata } from "next";
import Link from "@/components/ui/link";
import { markAttendance } from "@/attendance/actions";
import { batchAt, visitBatch } from "@/attendance/batches";
import { TodayCard } from "@/attendance/components/today-card";
import {
  daysInMonth,
  getBatches,
  getMonthSummary,
  isMonthKey,
  listVisitsOn,
  shiftMonthKey,
} from "@/attendance/queries";
import { requirePermission, viewerCan } from "@/auth/session";
import { NavIconSvg, type NavIcon } from "@/components/nav/nav-icons";
import { ActionForm } from "@/components/ui/action-form";
import { inputBase } from "@/components/ui/field";
import { Columns, Dial, iconButton } from "@/components/ui/viz";
import {
  formatMonth,
  formatShortDate,
  formatTime,
  todayAtGym,
} from "@/lib/dates";
import { formatPaise } from "@/lib/money";
import { listMembers, type MemberSummary } from "@/members/queries";

export const metadata: Metadata = { title: "Attendance" };

/** How many of today's check-ins the list shows; the card counts them all. */
const latestCount = 5;

const stepClass =
  "flex size-10 items-center justify-center rounded-control bg-white text-ink ring-1 ring-line transition-colors hover:bg-ink hover:text-white";

function matches(member: MemberSummary, query: string): boolean {
  const needle = query.toLowerCase();
  const digits = query.replace(/\D/g, "");
  return (
    member.fullName.toLowerCase().includes(needle) ||
    member.memberCode.toLowerCase().includes(needle) ||
    (digits.length >= 3 && member.phone.includes(digits))
  );
}

export default async function AttendancePage({
  searchParams,
}: PageProps<"/app/attendance">) {
  const viewer = await requirePermission("attendance.view", "/app/attendance");
  const params = await searchParams;
  const today = todayAtGym();
  const thisMonth = today.slice(0, 7);
  const month =
    isMonthKey(params.month) && params.month <= thisMonth
      ? params.month
      : thisMonth;
  const query =
    typeof params.q === "string" ? params.q.trim().slice(0, 60) : "";
  const canMark = viewerCan(viewer, "attendance.mark");
  const seesFees = viewerCan(viewer, "payments.viewSheet");

  const [visits, everyone, summary, batches] = await Promise.all([
    listVisitsOn(viewer, today),
    listMembers(viewer),
    getMonthSummary(viewer, month),
    getBatches(viewer),
  ]);
  const byId = new Map(everyone.map((member) => [member.id, member]));
  const inToday = new Set(visits.map((visit) => visit.memberId));
  const candidates = query
    ? everyone
        .filter(
          (member) =>
            member.status !== "inactive" &&
            !inToday.has(member.id) &&
            matches(member, query),
        )
        .slice(0, 8)
    : [];

  const withBatch = visits.map((visit) => ({
    ...visit,
    batch: visitBatch(visit.checkedInAt, batches),
  }));
  const morning = withBatch.filter((visit) => visit.batch === "morning").length;
  const evening = withBatch.filter((visit) => visit.batch === "evening").length;
  const openNow = batchAt(new Date(), batches);
  const latest = withBatch.slice(0, latestCount);
  const later = shiftMonthKey(month, 1);

  const current = everyone.filter(
    (member) => member.status !== "inactive",
  ).length;
  const days = daysInMonth(month);
  const perDay = new Map(summary.perDay.map((row) => [row.day, row.visits]));
  const peakIndex = summary.busiestDay
    ? days.indexOf(summary.busiestDay.day)
    : undefined;

  return (
    <div className="space-y-4">
      <header className="page-header flex items-center justify-between gap-3">
        <h1 className="page-title">Attendance</h1>
        {viewerCan(viewer, "desk.manage") && (
          <Link
            href="/app/attendance/setup"
            aria-label="Check-in QR"
            title="Check-in QR"
            className={`${iconButton} bg-ink text-white hover:bg-graphite`}
          >
            <NavIconSvg icon="qr" className="size-5" />
          </Link>
        )}
      </header>

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <TodayCard
          inToday={visits.length}
          current={current}
          morning={morning}
          evening={evening}
          batches={batches}
          openNow={openNow}
        />

        {canMark && (
          <section aria-label="Mark someone in" className="card p-4 sm:p-5">
            <form className="relative" role="search">
              <label className="sr-only" htmlFor="mark-search">
                Mark someone in
              </label>
              <NavIconSvg
                icon="markIn"
                className="pointer-events-none absolute top-1/2 left-3.5 size-5 -translate-y-1/2"
              />
              <input
                id="mark-search"
                name="q"
                type="search"
                defaultValue={query}
                placeholder="Name, phone or ID"
                className={`${inputBase} pl-11`}
              />
            </form>
            {query && candidates.length === 0 && (
              <p className="mt-4 text-center text-sm text-muted">No match</p>
            )}
            {candidates.length > 0 && (
              <ul className="mt-3 list-card">
                {candidates.map((member) => (
                  <li
                    key={member.id}
                    className="flex items-center justify-between gap-3 list-row py-2.5"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-semibold">
                        {member.fullName}
                      </p>
                      <p className="font-mono text-xs text-muted">
                        {member.memberCode}
                      </p>
                    </div>
                    <ActionForm
                      action={markAttendance}
                      submitLabel={`Mark ${member.fullName} in`}
                      icon="check"
                      className="[&>div]:mt-0 [&>div]:items-end"
                    >
                      <input type="hidden" name="memberId" value={member.id} />
                    </ActionForm>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
      </div>

      <section aria-label="Latest check-ins">
        {visits.length === 0 ? (
          <p className="rounded-card bg-white p-6 text-center text-muted shadow-card">
            Nobody yet
          </p>
        ) : (
          <ul className="list-card">
            {latest.map((visit) => {
              const member = byId.get(visit.memberId);
              const owes = seesFees && member && member.owedPaise > 0;
              const method =
                visit.method === "qr"
                  ? "Scanned QR"
                  : `Marked${visit.markedBy ? ` by ${visit.markedBy}` : ""}`;
              return (
                <li
                  key={visit.memberId}
                  className="flex items-center gap-3 list-row py-3"
                >
                  <span
                    title={method}
                    className="flex size-9 shrink-0 items-center justify-center rounded-control bg-canvas"
                  >
                    <NavIconSvg
                      icon={visit.method === "qr" ? "qr" : "user"}
                      className="size-4"
                    />
                    <span className="sr-only">{method}</span>
                  </span>
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/app/members/${visit.memberId}`}
                      className="block truncate font-semibold hover:underline hover:underline-offset-4"
                    >
                      {visit.fullName}
                    </Link>
                    <p className="font-mono text-xs text-muted">
                      {visit.memberCode}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className="text-sm font-medium tabular-nums">
                      {formatTime(visit.checkedInAt)}
                    </span>
                    {owes && (
                      <span className="rounded-badge bg-ink px-2 py-0.5 text-xs font-medium text-white tabular-nums">
                        <span className="sr-only">Owes </span>
                        {formatPaise(member.owedPaise)}
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
            {visits.length > latestCount && (
              <li className="list-row py-2.5 text-center text-xs text-muted tabular-nums">
                +{visits.length - latestCount}
              </li>
            )}
          </ul>
        )}
      </section>

      <section className="card-section">
        <div className="flex items-center justify-between gap-3">
          <h2 className="section-title">{formatMonth(month)}</h2>
          <nav aria-label="Months" className="flex gap-1.5">
            <Link
              href={{ query: { month: shiftMonthKey(month, -1) } }}
              aria-label={`Previous month, ${formatMonth(shiftMonthKey(month, -1))}`}
              className={stepClass}
            >
              <NavIconSvg icon="chevronLeft" className="size-5" />
            </Link>
            {month < thisMonth ? (
              <Link
                href={{ query: { month: later } }}
                aria-label={`Next month, ${formatMonth(later)}`}
                className={stepClass}
              >
                <NavIconSvg icon="chevronRight" className="size-5" />
              </Link>
            ) : (
              <span
                aria-hidden="true"
                className={`${stepClass} pointer-events-none opacity-35`}
              >
                <NavIconSvg icon="chevronRight" className="size-5" />
              </span>
            )}
          </nav>
        </div>

        <Columns
          values={days.map((day) => perDay.get(day) ?? 0)}
          highlight={peakIndex}
          label={`Visits per day in ${formatMonth(month)}`}
          className="mt-5 h-24"
        />
        <div
          aria-hidden="true"
          className="mt-1.5 flex justify-between text-[0.65rem] text-muted tabular-nums"
        >
          <span>1</span>
          <span>{days.length}</span>
        </div>

        <dl className="mt-5 grid grid-cols-3 gap-2">
          <MonthFigure icon="attendance" label="Visits">
            {summary.totalVisits}
          </MonthFigure>
          <MonthFigure
            icon="members"
            label="Members"
            aside={
              <Dial
                value={summary.members}
                max={current}
                size={34}
                stroke={3.5}
                label={`${summary.members} of ${current} current members came`}
              />
            }
          >
            {summary.members}
          </MonthFigure>
          <MonthFigure icon="arrow" label="Peak">
            {summary.busiestDay
              ? formatShortDate(summary.busiestDay.day, today)
              : "—"}
          </MonthFigure>
        </dl>
      </section>
    </div>
  );
}

function MonthFigure({
  icon,
  label,
  aside,
  children,
}: {
  icon: NavIcon;
  label: string;
  aside?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-2 rounded-tile bg-canvas p-3">
      <div className="min-w-0">
        <dt className="flex items-center gap-1.5 text-xs text-muted">
          <NavIconSvg icon={icon} className="size-3.5 shrink-0" />
          {label}
        </dt>
        <dd className="mt-1 truncate text-lg font-semibold tracking-tight tabular-nums">
          {children}
        </dd>
      </div>
      {aside && <span className="hidden sm:block">{aside}</span>}
    </div>
  );
}
