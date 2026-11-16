import Link from "next/link";
import { getOwnAttendance, listVisitsOn } from "@/attendance/queries";
import { isStaff } from "@/auth/permissions";
import { requireViewer, viewerCan, type Viewer } from "@/auth/session";
import { NavIconSvg, type NavIcon } from "@/components/nav/nav-icons";
import { formatDate, formatTime, todayAtGym } from "@/lib/dates";
import { formatPaise } from "@/lib/money";
import { StatusBadge } from "@/members/components/status-badge";
import { vapidKeys } from "@/notifications/channels";
import { PushToggle } from "@/notifications/components/push-toggle";
import type { MembershipStatus } from "@/members/billing";
import {
  getOwnMembership,
  listMembers,
  listWaitingGuests,
  type MemberSummary,
} from "@/members/queries";
import { PaymentHistory } from "@/payments/components/payment-history";
import { getMemberPayments } from "@/payments/queries";

export default async function AppHome() {
  const viewer = await requireViewer("/app");

  if (!viewer.isActive) return <AccountSwitchedOff />;
  if (viewer.role === "guest") return <WaitingForGym email={viewer.email} />;
  if (isStaff(viewer.role)) return <StaffHome viewer={viewer} />;
  return <MemberHome viewer={viewer} />;
}

function AccountSwitchedOff() {
  return (
    <section className="max-w-prose">
      <h1 className="page-title">This account is switched off</h1>
      <p className="mt-4 text-lg">
        The owner has turned off access for this account. If that&apos;s a
        mistake, talk to them at the gym.
      </p>
    </section>
  );
}

function WaitingForGym({ email }: { email: string | null }) {
  return (
    <section className="max-w-prose">
      <h1 className="page-title">Nearly there</h1>
      <p className="mt-4 text-lg">
        You&apos;re signed in, but the gym hasn&apos;t linked this account to
        your membership yet. Show this screen at the front desk, or open the
        claim link the gym sent you on WhatsApp.
      </p>
      {email && (
        <p className="mt-6 callout text-lg">
          Signed in as <strong className="break-all">{email}</strong>
        </p>
      )}
    </section>
  );
}

async function StaffHome({ viewer }: { viewer: Viewer }) {
  const canManage = viewerCan(viewer, "guests.link");
  const [members, guests, visits] = await Promise.all([
    listMembers(viewer),
    canManage ? listWaitingGuests(viewer) : Promise.resolve([]),
    listVisitsOn(viewer, todayAtGym()),
  ]);
  const count = (keep: (member: MemberSummary) => boolean) =>
    members.filter(keep).length;

  const current = count((member) => member.status !== "inactive");
  const inToday = visits.length;
  const share = current > 0 ? Math.min(100, (inToday / current) * 100) : 0;

  // Smaller figures under the headline pair. Ones that need someone to act
  // (money owed, people waiting) turn white when they're above zero.
  const tiles: Tile[] = [
    ...(canManage
      ? [
          {
            href: "/app/members?filter=overdue",
            figure: count((member) => member.standing === "overdue"),
            label: "Overdue",
            icon: "clock" as const,
            urgent: true,
          },
          {
            href: "/app/guests",
            figure: guests.length,
            label: "Waiting guests",
            icon: "guests" as const,
            urgent: true,
          },
          {
            href: "/app/members?filter=quiet",
            figure: count((member) => member.goneQuiet),
            label: "Gone quiet",
            icon: "moon" as const,
          },
        ]
      : []),
    {
      href: "/app/members?filter=frozen",
      figure: count((member) => member.status === "frozen"),
      label: "Frozen",
      icon: "pause",
    },
  ];

  const keys = vapidKeys();
  const showTeam = viewerCan(viewer, "roles.change");
  const hasAside = Boolean(keys) || showTeam;
  const firstName = (viewer.fullName || "").trim().split(/\s+/)[0];

  return (
    <section>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted">{todayLong()}</p>
          <h1 className="mt-1 page-title">
            {greeting()}
            {firstName ? `, ${firstName}` : ""}
          </h1>
        </div>
        {canManage && (
          <Link href="/app/members/new" className="btn-dark pr-5 pl-4">
            <NavIconSvg icon="plus" className="size-4" />
            Add member
          </Link>
        )}
      </header>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <div
          className={`card-dark p-5 sm:p-7 ${hasAside ? "lg:col-span-2" : "lg:col-span-3"}`}
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold tracking-tight">
                Front desk
              </h2>
              <p className="text-sm text-white/55">Today at the gym</p>
            </div>
            <Link
              href="/app/attendance"
              aria-label="Open attendance"
              className="flex size-10 items-center justify-center rounded-control bg-white/10 transition-colors hover:bg-white hover:text-ink"
            >
              <NavIconSvg icon="arrow" className="size-[1.1rem]" />
            </Link>
          </div>

          <div className="mt-6 flex items-center gap-5 sm:gap-8">
            <Headline
              href="/app/attendance"
              figure={inToday}
              label={["Checked in", "today"]}
            />
            <span aria-hidden="true" className="h-12 w-px bg-white/15" />
            <Headline
              href="/app/members"
              figure={current}
              label={["Current", "members"]}
            />
          </div>

          <div
            className="mt-5 h-1.5 overflow-hidden rounded-full bg-white/10"
            role="img"
            aria-label={`${Math.round(share)}% of current members are in today`}
          >
            <div
              className="h-full rounded-full bg-white"
              style={{ width: `${Math.max(share, inToday > 0 ? 4 : 0)}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-white/55">
            {Math.round(share)}% of current members in today
          </p>

          <ul
            className={`mt-6 grid gap-2.5 ${tiles.length > 1 ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-2"}`}
          >
            {tiles.map((tile) => {
              const lit = tile.urgent && tile.figure > 0;
              return (
                <li key={tile.href}>
                  <Link
                    href={tile.href}
                    className={`flex h-full flex-col rounded-tile p-4 transition-colors ${
                      lit
                        ? "bg-white text-ink hover:bg-mist"
                        : "bg-white/[0.07] hover:bg-white/[0.13]"
                    }`}
                  >
                    <span
                      className={`flex size-8 items-center justify-center rounded-control ${lit ? "bg-ink text-white" : "bg-white/10"}`}
                    >
                      <NavIconSvg icon={tile.icon} className="size-4" />
                    </span>
                    <span className="mt-4 text-3xl font-semibold tracking-tight tabular-nums">
                      {tile.figure}
                    </span>
                    <span
                      className={`text-xs ${lit ? "text-muted" : "text-white/60"}`}
                    >
                      {tile.label}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>

        {hasAside && (
          <div className="flex flex-col gap-4">
            {keys && (
              <div className="card p-5 sm:p-6">
                <div className="flex items-center gap-3">
                  <span className="flex size-10 items-center justify-center rounded-control bg-canvas">
                    <NavIconSvg icon="reminders" className="size-5" />
                  </span>
                  <h2 className="font-semibold tracking-tight">
                    Notifications on this phone
                  </h2>
                </div>
                <p className="mt-3 mb-5 text-sm text-muted">
                  Members get fee reminders this way. Turn it on here and send
                  yourself a test to see what they will see.
                </p>
                <PushToggle vapidPublicKey={keys.publicKey} />
              </div>
            )}
            {showTeam && (
              <Link
                href="/app/team"
                className="group flex items-center gap-4 card p-5 transition-shadow hover:shadow-float sm:p-6"
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-control bg-canvas">
                  <NavIconSvg icon="team" className="size-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold tracking-tight">
                    Adding staff
                  </span>
                  <span className="mt-0.5 block text-sm text-muted">
                    They sign in with Google first, then you give them a role on
                    the team page.
                  </span>
                </span>
                <span className="flex size-9 shrink-0 items-center justify-center rounded-control bg-canvas transition-colors group-hover:bg-ink group-hover:text-white">
                  <NavIconSvg icon="arrow" className="size-4" />
                </span>
              </Link>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

function Headline({
  href,
  figure,
  label,
}: {
  href: string;
  figure: number;
  label: [string, string];
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-tile transition-opacity hover:opacity-80"
    >
      <span className="text-5xl font-semibold tracking-tight tabular-nums sm:text-6xl">
        {figure}
      </span>
      <span className="text-sm leading-tight text-white/60">
        {label[0]}
        <br />
        {label[1]}
      </span>
    </Link>
  );
}

interface Tile {
  href: string;
  figure: number;
  label: string;
  icon: NavIcon;
  urgent?: boolean;
}

const gymZone = "Asia/Kolkata";

function todayLong(): string {
  return new Intl.DateTimeFormat("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: gymZone,
  }).format(new Date());
}

function greeting(): string {
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", {
      hour: "numeric",
      hourCycle: "h23",
      timeZone: gymZone,
    }).format(new Date()),
  );
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

async function MemberHome({ viewer }: { viewer: Viewer }) {
  const membership = await getOwnMembership(viewer);
  const today = todayAtGym();

  if (!membership) {
    return (
      <section className="max-w-prose">
        <h1 className="page-title">Your membership</h1>
        <p className="mt-4 text-lg">
          We couldn&apos;t find your member record. Ask at the front desk.
        </p>
      </section>
    );
  }

  const [payments, visits] = await Promise.all([
    getMemberPayments(viewer, membership.memberId),
    getOwnAttendance(viewer, membership.memberId),
  ]);

  return (
    <section className="max-w-prose">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="page-title">Your membership</h1>
        <StatusBadge status={membership.status} />
      </div>
      <dl className="mt-6 grid grid-cols-[auto_1fr] items-baseline gap-x-8 gap-y-3 card p-5 text-lg sm:p-6">
        <dt className="text-muted">Member ID</dt>
        <dd className="font-mono text-2xl font-bold">
          {membership.memberCode}
        </dd>
        {membership.startsOn && (
          <>
            <dt className="text-muted">Member since</dt>
            <dd>{formatDate(membership.startsOn)}</dd>
          </>
        )}
        {membership.feePaise !== null && (
          <>
            <dt className="text-muted">Monthly fee</dt>
            <dd>
              {membership.feePaise === 0
                ? "Free"
                : formatPaise(membership.feePaise)}
            </dd>
          </>
        )}
        {membership.nextDue && (
          <>
            <dt className="text-muted">Next due</dt>
            <dd className="font-semibold">{formatDate(membership.nextDue)}</dd>
          </>
        )}
      </dl>
      <div className="mt-8 card p-5">
        {visits.today ? (
          <p className="text-lg">
            <strong>Checked in today</strong> at {formatTime(visits.today)}.
          </p>
        ) : (
          <>
            <p className="text-lg">Not checked in today.</p>
            <Link href="/app/check-in" className="mt-3 btn-dark">
              Check in
            </Link>
          </>
        )}
      </div>

      <h2 className="mt-10 mb-4 section-title">
        Visits · {visits.thisMonth} this month
      </h2>
      {visits.recent.length === 0 ? (
        <p className="text-lg text-muted">No visits yet.</p>
      ) : (
        <ul className="list-card">
          {visits.recent.map((visit) => (
            <li
              key={visit.gymDate}
              className="flex justify-between gap-4 list-row py-3.5"
            >
              <span>{formatDate(visit.gymDate)}</span>
              <span className="text-muted">
                {formatTime(visit.checkedInAt)}
                {visit.method === "manual" ? " · marked at desk" : ""}
              </span>
            </li>
          ))}
        </ul>
      )}

      <FeeReminders
        status={membership.status}
        allowed={membership.remindersAllowed}
      />

      <h2 className="mt-10 mb-4 section-title">Payments</h2>
      {payments.ledger && payments.ledger.owedPaise > 0 && (
        <p className="mb-4 callout text-lg">
          {formatPaise(payments.ledger.owedPaise)} is due. Pay at the front
          desk.
        </p>
      )}
      <PaymentHistory
        history={payments.history}
        canVoid={false}
        today={today}
      />
    </section>
  );
}

function FeeReminders({
  status,
  allowed,
}: {
  status: MembershipStatus;
  allowed: boolean;
}) {
  const keys = vapidKeys();
  if (!keys || status === "free" || status === "inactive") return null;

  return (
    <div className="mt-8 card p-5">
      <h2 className="text-lg font-semibold tracking-tight">Fee reminders</h2>
      {allowed ? (
        <>
          <p className="mt-1 mb-4">
            Get a notification 3 days before your fee is due, on the day, and if
            it&apos;s late.
          </p>
          <PushToggle vapidPublicKey={keys.publicKey} />
        </>
      ) : (
        <p className="mt-1">
          Reminders are off for you. Ask at the front desk to turn them on.
        </p>
      )}
    </div>
  );
}
