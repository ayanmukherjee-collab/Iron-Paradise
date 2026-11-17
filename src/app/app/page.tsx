import Link from "@/components/ui/link";
import { batchAt, visitBatch } from "@/attendance/batches";
import { TodayCard } from "@/attendance/components/today-card";
import {
  getBatches,
  getOwnAttendance,
  listVisitsOn,
} from "@/attendance/queries";
import { isStaff } from "@/auth/permissions";
import {
  AccountSwitchedOff,
  WaitingForGym,
} from "@/auth/components/waiting-screens";
import { requireViewer, viewerCan, type Viewer } from "@/auth/session";
import { NavIconSvg } from "@/components/nav/nav-icons";
import { CloseToday, Notices } from "@/bulletin/components/gym-controls";
import { CrowdCard } from "@/bulletin/components/crowd-card";
import { MemberBulletin } from "@/bulletin/components/member-bulletin";
import { getTodayControls } from "@/bulletin/queries";
import {
  Meter,
  SegmentBar,
  StatCard,
  iconButton,
  type Segment,
} from "@/components/ui/viz";
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
import { MoneyCards, shortMonth } from "@/payments/components/money-cards";
import { getCollected, getMemberPayments } from "@/payments/queries";

export default async function AppHome() {
  const viewer = await requireViewer("/app");

  if (!viewer.isActive) return <AccountSwitchedOff />;
  if (viewer.role === "guest") return <WaitingForGym email={viewer.email} />;
  if (isStaff(viewer.role)) return <StaffHome viewer={viewer} />;
  return <MemberHome viewer={viewer} />;
}

async function StaffHome({ viewer }: { viewer: Viewer }) {
  const canManage = viewerCan(viewer, "guests.link");
  const seesFees = viewerCan(viewer, "payments.viewSheet");
  const canAdd = viewerCan(viewer, "members.edit");
  const today = todayAtGym();
  const thisMonth = today.slice(0, 7);
  const canPublish = viewerCan(viewer, "bulletin.publish");
  const [members, guests, visits, batches, collectedPaise, controls] =
    await Promise.all([
      listMembers(viewer),
      canManage ? listWaitingGuests(viewer) : Promise.resolve([]),
      listVisitsOn(viewer, today),
      getBatches(viewer),
      seesFees
        ? getCollected(viewer, `${thisMonth}-01`, today)
        : Promise.resolve(0),
      canPublish ? getTodayControls(viewer) : Promise.resolve(null),
    ]);
  const count = (keep: (member: MemberSummary) => boolean) =>
    members.filter(keep).length;

  const current = count((member) => member.status !== "inactive");
  const morning = visits.filter(
    (visit) => visitBatch(visit.checkedInAt, batches) === "morning",
  ).length;
  const evening = visits.filter(
    (visit) => visitBatch(visit.checkedInAt, batches) === "evening",
  ).length;
  const quiet = count((member) => member.goneQuiet);
  const frozen = count((member) => member.status === "frozen");

  const keys = vapidKeys();
  const firstName = (viewer.fullName || "").trim().split(/\s+/)[0];

  return (
    <section>
      {/* Stays put while the cards scroll under it. */}
      <header className="page-header">
        <p className="text-sm text-muted">{todayLong()}</p>
        <h1 className="mt-0.5 page-title">
          {greeting()}
          {firstName ? `, ${firstName}` : ""}
        </h1>
      </header>

      <div className="mt-2 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <TodayCard
          className="col-span-2"
          inToday={visits.length}
          current={current}
          morning={morning}
          evening={evening}
          batches={batches}
          openNow={batchAt(new Date(), batches)}
          href="/app/attendance"
        />
        <MembersCard
          members={members}
          current={current}
          seesFees={seesFees}
          canAdd={canAdd}
        />
        <CrowdCard className="col-span-2" />

        {seesFees && (
          <MoneyCards
            monthLabel={shortMonth(thisMonth)}
            figures={{
              // Only current members count towards dues.
              outstandingPaise: members
                .filter((member) => member.status !== "inactive")
                .reduce((sum, member) => sum + member.owedPaise, 0),
              owing: count(
                (member) =>
                  member.status !== "inactive" && member.owedPaise > 0,
              ),
              paying: count(
                (member) =>
                  member.standing !== null && member.standing !== "free",
              ),
              overdue: count((member) => member.standing === "overdue"),
              collectedPaise,
            }}
          />
        )}
        {canManage && (
          <StatCard
            href="/app/guests"
            icon="guests"
            label="Waiting"
            figure={guests.length}
            lit={guests.length > 0}
          />
        )}
        {canManage && (
          <StatCard
            href="/app/members?filter=quiet"
            icon="moon"
            label="Gone quiet"
            figure={quiet}
            visual={(tone) => (
              <Meter
                value={quiet}
                max={current}
                tone={tone}
                label={`${quiet} of ${current} current members gone quiet`}
              />
            )}
          />
        )}
        <StatCard
          href="/app/members?filter=frozen"
          icon="pause"
          label="Frozen"
          figure={frozen}
          visual={(tone) => (
            <Meter
              value={frozen}
              max={current}
              tone={tone}
              label={`${frozen} of ${current} current members frozen`}
            />
          )}
        />
        {keys && (
          <div
            className={`flex items-center gap-3 card p-4 sm:p-5 ${canManage ? "col-span-2" : ""}`}
          >
            <span className="flex size-8 shrink-0 items-center justify-center rounded-control bg-canvas">
              <NavIconSvg icon="reminders" className="size-4" />
            </span>
            <PushToggle vapidPublicKey={keys.publicKey} compact />
          </div>
        )}
        {/* Owner and manager tools sit last, folded away until needed. */}
        {controls && (
          <>
            <CloseToday controls={controls} className="col-span-2" />
            <Notices controls={controls} className="col-span-2" />
          </>
        )}
      </div>
    </section>
  );
}

const freeFill = "bg-white ring-1 ring-inset ring-ink/25";
// Diagonal stripes, so overdue reads apart from paid without colour.
const hatch =
  "bg-[repeating-linear-gradient(-45deg,var(--color-ink)_0_2px,rgb(12_12_13/0.25)_2px_4px)]";

/** Everyone current, split by where they stand, with the add button. */
function MembersCard({
  members,
  current,
  seesFees,
  canAdd,
}: {
  members: MemberSummary[];
  current: number;
  seesFees: boolean;
  canAdd: boolean;
}) {
  const count = (keep: (member: MemberSummary) => boolean) =>
    members.filter(keep).length;
  const active = (standing: string) =>
    count(
      (member) => member.status === "active" && member.standing === standing,
    );
  const frozen = count((member) => member.status === "frozen");
  const free = count((member) => member.status === "free");
  const segments: Segment[] = seesFees
    ? [
        { key: "paid", label: "Paid", value: active("paid"), fill: "bg-ink" },
        { key: "due", label: "Due", value: active("due"), fill: "bg-ink/45" },
        {
          key: "overdue",
          label: "Overdue",
          value: active("overdue"),
          fill: hatch,
        },
        { key: "frozen", label: "Frozen", value: frozen, fill: "bg-ink/15" },
        { key: "free", label: "Free", value: free, fill: freeFill },
      ]
    : [
        {
          key: "active",
          label: "Active",
          value: count((member) => member.status === "active"),
          fill: "bg-ink",
        },
        { key: "frozen", label: "Frozen", value: frozen, fill: "bg-ink/15" },
        { key: "free", label: "Free", value: free, fill: freeFill },
      ];

  return (
    <section
      aria-label="Members"
      className="col-span-2 flex flex-col card p-5 sm:p-6"
    >
      <div className="flex items-center justify-between gap-3">
        <Link
          href="/app/members"
          className="flex items-center gap-2 text-sm font-medium hover:underline hover:underline-offset-4"
        >
          <NavIconSvg icon="members" className="size-4" />
          Members
        </Link>
        {canAdd && (
          <Link
            href="/app/members/new"
            aria-label="Add member"
            title="Add member"
            className={`${iconButton} bg-ink text-white hover:bg-graphite`}
          >
            <NavIconSvg icon="plus" className="size-5" />
          </Link>
        )}
      </div>
      <Link
        href="/app/members"
        className="mt-3 block self-start text-5xl font-semibold tracking-tight tabular-nums transition-opacity hover:opacity-80 sm:text-6xl"
      >
        {current}
      </Link>
      <div className="mt-auto pt-5">
        <SegmentBar segments={segments} />
      </div>
    </section>
  );
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
        {/* The gym's hours, notices and crowd still apply to them. */}
        <MemberBulletin />
        <CrowdCard className="mt-4" />
      </section>
    );
  }

  const [payments, visits] = await Promise.all([
    getMemberPayments(viewer, membership.memberId),
    getOwnAttendance(viewer, membership.memberId),
  ]);

  return (
    <section className="max-w-prose">
      <header className="page-header flex flex-wrap items-center gap-3">
        <h1 className="page-title">Your membership</h1>
        <StatusBadge status={membership.status} />
      </header>
      <MemberBulletin />
      <CrowdCard className="mt-4" />
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
