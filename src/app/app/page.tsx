import Link from "next/link";
import { getOwnAttendance, listVisitsOn } from "@/attendance/queries";
import { isStaff } from "@/auth/permissions";
import { requireViewer, viewerCan, type Viewer } from "@/auth/session";
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
      <h1 className="display text-5xl">This account is switched off</h1>
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
      <h1 className="display text-5xl">Nearly there</h1>
      <p className="mt-4 text-lg">
        You&apos;re signed in, but the gym hasn&apos;t linked this account to
        your membership yet. Show this screen at the front desk, or open the
        claim link the gym sent you on WhatsApp.
      </p>
      {email && (
        <p className="mt-6 border-l-4 border-ink pl-3 text-lg">
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

  const stats: Stat[] = [
    { href: "/app/attendance", figure: visits.length, label: "In today" },
    {
      href: "/app/members",
      figure: count((member) => member.status !== "inactive"),
      label: "Current members",
    },
    ...(canManage
      ? [
          {
            href: "/app/members?filter=overdue",
            figure: count((member) => member.standing === "overdue"),
            label: "Overdue",
          },
          {
            href: "/app/guests",
            figure: guests.length,
            label: "Waiting guests",
          },
          {
            href: "/app/members?filter=quiet",
            figure: count((member) => member.goneQuiet),
            label: "Gone quiet",
          },
        ]
      : []),
    {
      href: "/app/members?filter=frozen",
      figure: count((member) => member.status === "frozen"),
      label: "Frozen",
    },
  ];

  return (
    <section>
      <h1 className="display text-5xl">Front desk</h1>
      <div className="mt-8 border-2 border-ink bg-white">
        <div className={`grid grid-cols-2 ${wideColumns[stats.length]}`}>
          {stats.map((stat, index) => (
            <Link
              key={stat.href}
              href={stat.href}
              className={`block p-5 hover:bg-ink hover:text-white ${statBorders(index, stats.length)}`}
            >
              <span className="block min-h-10 text-sm font-bold tracking-[0.08em] uppercase">
                {stat.label}
              </span>
              <span className="mt-2 block display text-5xl">{stat.figure}</span>
            </Link>
          ))}
        </div>
        {canManage && (
          <Link
            href="/app/members/new"
            className="flex min-h-14 items-center justify-between border-t-2 border-ink bg-ink px-5 text-sm font-bold tracking-[0.08em] text-white uppercase hover:bg-ash"
          >
            Add a member
            <span aria-hidden="true" className="display text-3xl">
              +
            </span>
          </Link>
        )}
      </div>
      {viewerCan(viewer, "roles.change") && (
        <p className="mt-8 max-w-prose text-lg">
          New staff sign in with Google first, then you give them a role on the{" "}
          <Link
            href="/app/team"
            className="font-semibold underline underline-offset-4"
          >
            team page
          </Link>
          .
        </p>
      )}
      <PhoneNotifications />
    </section>
  );
}

/**
 * Staff get no fee reminders of their own, but can turn notifications on to
 * check push works on a phone before members rely on it.
 */
function PhoneNotifications() {
  const keys = vapidKeys();
  if (!keys) return null;
  return (
    <div className="mt-8 max-w-prose border-2 border-ink bg-white p-5">
      <h2 className="text-lg font-bold">Notifications on this phone</h2>
      <p className="mt-1 mb-4">
        Members get fee reminders this way. Turn it on here and send yourself a
        test to see what they will see.
      </p>
      <PushToggle vapidPublicKey={keys.publicKey} />
    </div>
  );
}

interface Stat {
  href: string;
  figure: number;
  label: string;
}

// Every stat fits on one row on wide screens. Written out in full so
// Tailwind can see the class names.
const wideColumns: Record<number, string> = {
  2: "lg:grid-cols-2",
  3: "lg:grid-cols-3",
  4: "lg:grid-cols-4",
  5: "lg:grid-cols-5",
  6: "lg:grid-cols-6",
};

// Hard rules between cells: a 2-column grid on phones, one row on wide
// screens. Rules sit on the right of every cell but the last in a row, and
// on the top of every cell after the first row.
function statBorders(index: number, total: number): string {
  const classes = [];
  if (index % 2 === 0 && index < total - 1)
    classes.push("border-r-2 border-ink");
  if (index >= 2) classes.push("border-t-2 border-ink lg:border-t-0");
  if (index % 2 === 1 && index < total - 1)
    classes.push("lg:border-r-2 lg:border-ink");
  return classes.join(" ");
}

async function MemberHome({ viewer }: { viewer: Viewer }) {
  const membership = await getOwnMembership(viewer);
  const today = todayAtGym();

  if (!membership) {
    return (
      <section className="max-w-prose">
        <h1 className="display text-5xl">Your membership</h1>
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
        <h1 className="display text-5xl">Your membership</h1>
        <StatusBadge status={membership.status} />
      </div>
      <dl className="mt-6 grid grid-cols-[auto_1fr] gap-x-8 gap-y-3 text-lg">
        <dt className="text-smoke">Member ID</dt>
        <dd className="font-mono text-2xl font-bold">
          {membership.memberCode}
        </dd>
        {membership.startsOn && (
          <>
            <dt className="text-smoke">Member since</dt>
            <dd>{formatDate(membership.startsOn)}</dd>
          </>
        )}
        {membership.feePaise !== null && (
          <>
            <dt className="text-smoke">Monthly fee</dt>
            <dd>
              {membership.feePaise === 0
                ? "Free"
                : formatPaise(membership.feePaise)}
            </dd>
          </>
        )}
        {membership.nextDue && (
          <>
            <dt className="text-smoke">Next due</dt>
            <dd className="font-semibold">{formatDate(membership.nextDue)}</dd>
          </>
        )}
      </dl>
      <div className="mt-8 border-2 border-ink bg-white p-5">
        {visits.today ? (
          <p className="text-lg">
            <strong>Checked in today</strong> at {formatTime(visits.today)}.
          </p>
        ) : (
          <>
            <p className="text-lg">Not checked in today.</p>
            <Link
              href="/app/check-in"
              className="mt-3 inline-flex min-h-12 items-center bg-ink px-6 text-sm font-bold tracking-[0.08em] text-white uppercase hover:bg-ash"
            >
              Check in
            </Link>
          </>
        )}
      </div>

      <h2 className="mt-10 mb-4 display text-3xl">
        Visits · {visits.thisMonth} this month
      </h2>
      {visits.recent.length === 0 ? (
        <p className="text-lg text-smoke">No visits yet.</p>
      ) : (
        <ul className="border-t-2 border-ink">
          {visits.recent.map((visit) => (
            <li
              key={visit.gymDate}
              className="flex justify-between gap-4 border-b-2 border-ink py-2"
            >
              <span>{formatDate(visit.gymDate)}</span>
              <span className="text-smoke">
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

      <h2 className="mt-10 mb-4 display text-3xl">Payments</h2>
      {payments.ledger && payments.ledger.owedPaise > 0 && (
        <p className="mb-4 border-l-4 border-ink pl-3 text-lg">
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
    <div className="mt-8 border-2 border-ink bg-white p-5">
      <h2 className="text-lg font-bold">Fee reminders</h2>
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
