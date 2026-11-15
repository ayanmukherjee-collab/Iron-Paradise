import type { Metadata } from "next";
import Link from "next/link";
import { markAttendance } from "@/attendance/actions";
import {
  getMonthSummary,
  isMonthKey,
  listVisitsOn,
  shiftMonthKey,
} from "@/attendance/queries";
import { requirePermission, viewerCan } from "@/auth/session";
import { ActionForm } from "@/components/ui/action-form";
import { inputClass } from "@/components/ui/field";
import { formatDate, formatMonth, formatTime, todayAtGym } from "@/lib/dates";
import { formatPaise } from "@/lib/money";
import { listMembers, type MemberSummary } from "@/members/queries";

export const metadata: Metadata = { title: "Attendance" };

const linkClass =
  "inline-flex min-h-10 items-center border-2 border-ink bg-white px-3 text-sm font-semibold hover:bg-ink hover:text-white";

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

  const [visits, everyone, summary] = await Promise.all([
    listVisitsOn(viewer, today),
    listMembers(viewer),
    getMonthSummary(viewer, month),
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

  return (
    <div className="space-y-12">
      <section>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h1 className="display text-5xl">Attendance</h1>
          {viewerCan(viewer, "desk.manage") && (
            <Link href="/app/attendance/setup" className={linkClass}>
              Check-in QR setup
            </Link>
          )}
        </div>

        <h2 className="mt-8 display text-3xl">Today · {visits.length} in</h2>
        <p className="mt-1 text-smoke">{formatDate(today)}</p>
        {visits.length === 0 ? (
          <p className="mt-4 text-lg">Nobody has checked in yet today.</p>
        ) : (
          <ul className="mt-4 border-t-2 border-ink">
            {visits.map((visit) => {
              const member = byId.get(visit.memberId);
              const owes = seesFees && member && member.owedPaise > 0;
              return (
                <li
                  key={visit.memberId}
                  className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b-2 border-ink py-3"
                >
                  <div className="flex items-baseline gap-3">
                    <span className="w-20 shrink-0 font-mono text-sm">
                      {formatTime(visit.checkedInAt)}
                    </span>
                    <Link
                      href={`/app/members/${visit.memberId}`}
                      className="text-lg font-semibold hover:underline"
                    >
                      {visit.fullName}
                    </Link>
                    <span className="font-mono text-sm text-smoke">
                      {visit.memberCode}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    {owes && (
                      <span className="bg-ink px-2 py-0.5 font-bold tracking-[0.08em] text-white uppercase">
                        Owes {formatPaise(member.owedPaise)}
                      </span>
                    )}
                    <span className="text-smoke">
                      {visit.method === "qr"
                        ? "Scanned QR"
                        : `Marked${visit.markedBy ? ` by ${visit.markedBy}` : ""}`}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {canMark && (
        <section className="border-t-2 border-ink pt-6">
          <h2 className="display text-3xl">Mark someone in</h2>
          <p className="mt-2 max-w-prose text-lg">
            For members without the app, or when the camera won&apos;t play
            along.
          </p>
          <form className="mt-4 max-w-md" role="search">
            <label className="sr-only" htmlFor="mark-search">
              Find a member
            </label>
            <input
              id="mark-search"
              name="q"
              type="search"
              defaultValue={query}
              placeholder="Name, phone or member ID"
              className={inputClass}
            />
          </form>
          {query && candidates.length === 0 && (
            <p className="mt-4 text-lg">
              Nobody matches, or they&apos;re already in today.
            </p>
          )}
          <ul className="mt-4 space-y-2">
            {candidates.map((member) => (
              <li
                key={member.id}
                className="flex flex-wrap items-center justify-between gap-3 border-2 border-ink bg-white p-3"
              >
                <div>
                  <p className="font-semibold">{member.fullName}</p>
                  <p className="font-mono text-sm text-smoke">
                    {member.memberCode}
                  </p>
                </div>
                <ActionForm
                  action={markAttendance}
                  submitLabel="Mark in"
                  pendingLabel="Marking…"
                  className="[&>div]:mt-0"
                >
                  <input type="hidden" name="memberId" value={member.id} />
                </ActionForm>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="border-t-2 border-ink pt-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2 className="display text-3xl">{formatMonth(month)}</h2>
          <nav aria-label="Months" className="flex gap-2">
            <Link
              href={{ query: { month: shiftMonthKey(month, -1) } }}
              className={linkClass}
            >
              ← Earlier
            </Link>
            {month < thisMonth && (
              <Link
                href={{ query: { month: shiftMonthKey(month, 1) } }}
                className={linkClass}
              >
                Later →
              </Link>
            )}
          </nav>
        </div>
        <dl className="mt-4 grid max-w-md grid-cols-[auto_1fr] gap-x-8 gap-y-2 text-lg">
          <dt className="text-smoke">Visits</dt>
          <dd className="font-semibold">{summary.totalVisits}</dd>
          <dt className="text-smoke">Members who came</dt>
          <dd className="font-semibold">{summary.perMember.length}</dd>
          {summary.busiestDay && (
            <>
              <dt className="text-smoke">Busiest day</dt>
              <dd className="font-semibold">
                {formatDate(summary.busiestDay.day)} (
                {summary.busiestDay.visits})
              </dd>
            </>
          )}
        </dl>
        {summary.perMember.length > 0 && (
          <ul className="mt-6 border-t-2 border-ink">
            {summary.perMember.map((row) => (
              <li
                key={row.memberId}
                className="flex items-baseline justify-between gap-4 border-b-2 border-ink py-2"
              >
                <Link
                  href={`/app/members/${row.memberId}`}
                  className="hover:underline"
                >
                  {row.fullName}{" "}
                  <span className="font-mono text-sm text-smoke">
                    {row.memberCode}
                  </span>
                </Link>
                <span className="font-mono font-bold">{row.visits}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
