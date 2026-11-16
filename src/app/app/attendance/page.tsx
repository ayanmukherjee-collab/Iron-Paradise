import type { Metadata } from "next";
import Link from "@/components/ui/link";
import { markAttendance } from "@/attendance/actions";
import { batchAt, batchHours, batchLabels } from "@/attendance/batches";
import {
  getBatches,
  getMonthSummary,
  isMonthKey,
  listVisitsOn,
  shiftMonthKey,
} from "@/attendance/queries";
import { requirePermission, viewerCan } from "@/auth/session";
import { NavIconSvg } from "@/components/nav/nav-icons";
import { ActionForm } from "@/components/ui/action-form";
import { inputBase } from "@/components/ui/field";
import { StatusCard } from "@/components/ui/status-card";
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
    batch: batchAt(visit.checkedInAt, batches),
  }));
  const morning = withBatch.filter((visit) => visit.batch === "morning").length;
  const evening = withBatch.filter((visit) => visit.batch === "evening").length;
  const openNow = batchAt(new Date(), batches);
  const latest = withBatch.slice(0, latestCount);
  const later = shiftMonthKey(month, 1);

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between gap-3">
        <h1 className="page-title">Attendance</h1>
        {viewerCan(viewer, "desk.manage") && (
          <Link href="/app/attendance/setup" className="btn-dark pr-5 pl-4">
            <NavIconSvg icon="checkIn" className="size-[1.1rem]" />
            Check-in QR
          </Link>
        )}
      </header>

      <StatusCard
        title={`Today · ${formatShortDate(today, today)}`}
        aside={
          openNow ? (
            <span className="inline-flex items-center gap-1.5 font-medium text-ink">
              <span className="size-1.5 rounded-full bg-ink" />
              {batchLabels[openNow]} batch open
            </span>
          ) : (
            "Check-in closed now"
          )
        }
        figures={[
          {
            label: "Morning",
            value: String(morning),
            note: batchHours(batches, "morning"),
          },
          {
            label: "Evening",
            value: String(evening),
            note: batchHours(batches, "evening"),
          },
          { label: "Total in today", value: String(visits.length) },
        ]}
      />

      {canMark && (
        <section className="card-section">
          <h2 className="section-title">Mark someone in</h2>
          <p className="mt-1 text-sm text-muted">
            For members without the app, or when the camera won&apos;t play
            along. Only during a batch.
          </p>
          <form className="relative mt-4" role="search">
            <label className="sr-only" htmlFor="mark-search">
              Find a member
            </label>
            <NavIconSvg
              icon="search"
              className="pointer-events-none absolute top-1/2 left-3.5 size-[1.1rem] -translate-y-1/2 text-muted"
            />
            <input
              id="mark-search"
              name="q"
              type="search"
              defaultValue={query}
              placeholder="Name, phone or member ID"
              className={`${inputBase} pl-10`}
            />
          </form>
          {query && candidates.length === 0 && (
            <p className="mt-4 text-sm text-muted">
              Nobody matches, or they&apos;re already in today.
            </p>
          )}
          {candidates.length > 0 && (
            <ul className="mt-4 list-card">
              {candidates.map((member) => (
                <li
                  key={member.id}
                  className="flex items-center justify-between gap-3 list-row py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{member.fullName}</p>
                    <p className="font-mono text-xs text-muted">
                      {member.memberCode}
                    </p>
                  </div>
                  <ActionForm
                    action={markAttendance}
                    submitLabel="Mark in"
                    pendingLabel="Marking…"
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

      <section>
        <div className="flex items-baseline justify-between gap-3 px-1">
          <h2 className="section-title">Latest check-ins</h2>
          {visits.length > latestCount && (
            <p className="text-sm text-muted">
              {latestCount} of {visits.length}
            </p>
          )}
        </div>
        {visits.length === 0 ? (
          <p className="mt-3 rounded-card bg-white p-6 text-center text-muted shadow-card">
            Nobody has checked in yet today.
          </p>
        ) : (
          <ul className="mt-3 list-card">
            {latest.map((visit) => {
              const member = byId.get(visit.memberId);
              const owes = seesFees && member && member.owedPaise > 0;
              return (
                <li
                  key={visit.memberId}
                  className="flex items-center justify-between gap-4 list-row py-3"
                >
                  <div className="min-w-0">
                    <Link
                      href={`/app/members/${visit.memberId}`}
                      className="block truncate font-semibold hover:underline hover:underline-offset-4"
                    >
                      {visit.fullName}
                    </Link>
                    <p className="truncate text-sm text-muted">
                      <span className="font-mono text-xs">
                        {visit.memberCode}
                      </span>
                      {" · "}
                      {visit.method === "qr"
                        ? "Scanned QR"
                        : `Marked${visit.markedBy ? ` by ${visit.markedBy}` : ""}`}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className="text-sm font-medium tabular-nums">
                      {formatTime(visit.checkedInAt)}
                    </span>
                    {owes ? (
                      <span className="rounded-badge bg-ink px-2 py-0.5 text-xs font-medium text-white">
                        Owes {formatPaise(member.owedPaise)}
                      </span>
                    ) : (
                      visit.batch && (
                        <span className="text-xs text-muted">
                          {batchLabels[visit.batch]}
                        </span>
                      )
                    )}
                  </div>
                </li>
              );
            })}
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
        <dl className="mt-4 grid grid-cols-3 divide-x divide-line">
          {[
            { label: "Visits", value: String(summary.totalVisits) },
            {
              label: "Members came",
              value: String(summary.perMember.length),
            },
            {
              label: summary.busiestDay
                ? `Busiest · ${summary.busiestDay.visits} in`
                : "Busiest day",
              value: summary.busiestDay
                ? formatShortDate(summary.busiestDay.day, today)
                : "—",
            },
          ].map((stat) => (
            <div
              key={stat.label}
              className="flex min-w-0 flex-col px-3 first:pl-0 last:pr-0"
            >
              <dt className="order-2 text-xs leading-snug text-muted">
                {stat.label}
              </dt>
              <dd className="order-1 truncate text-xl font-semibold tracking-tight tabular-nums">
                {stat.value}
              </dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}
