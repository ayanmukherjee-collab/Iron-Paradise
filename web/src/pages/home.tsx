// Mirrors src/app/app/page.tsx and src/members/components/member-home.tsx.
import Link from "@/components/ui/link";
import { batchAt, visitBatch } from "@/attendance/batches";
import { TodayCard } from "@/attendance/components/today-card";
import { VisitCharts } from "@/attendance/components/visit-charts";
import { isStaff } from "@/auth/permissions";
import {
  AccountSwitchedOff,
  WaitingForGym,
} from "@/auth/components/waiting-screens";
import { CloseToday, Notices } from "@/bulletin/components/gym-controls";
import { CrowdCard } from "@/bulletin/components/crowd-card";
import { MemberBulletin } from "@/bulletin/components/member-bulletin";
import { NavIconSvg } from "@/components/nav/nav-icons";
import { Disclosure } from "@/components/ui/disclosure";
import {
  Meter,
  SegmentBar,
  StatCard,
  iconButton,
  type Segment,
} from "@/components/ui/viz";
import { formatShortDate, formatTime, todayAtGym } from "@/lib/dates";
import { formatPaise } from "@/lib/money";
import type { MembershipStatus } from "@/members/billing";
import { MemberCard } from "@/members/components/member-card";
import { PushToggle } from "@/notifications/components/push-toggle";
import { MoneyCards, shortMonth } from "@/payments/components/money-cards";
import { PaymentHistory } from "@/payments/components/payment-history";
import { useViewer, viewerCan, type Viewer } from "../auth/viewer";
import {
  getBatches,
  getOwnAttendance,
  getTodayControls,
  listVisitsOn,
} from "../data/attendance";
import {
  getOwnMembership,
  listMembers,
  listWaitingGuests,
  type MemberSummary,
} from "../data/members";
import { getCollected, getMemberPayments } from "../data/payments";
import { Loaded, useLoad, useTitle } from "../data/use-load";
import { env } from "../lib/env";

export function HomePage() {
  const viewer = useViewer();
  useTitle("Home");

  if (!viewer.isActive) return <AccountSwitchedOff />;
  if (viewer.role === "guest") return <WaitingForGym email={viewer.email} />;
  if (isStaff(viewer.role)) return <StaffHome viewer={viewer} />;
  return <MemberHome viewer={viewer} />;
}

function StaffHome({ viewer }: { viewer: Viewer }) {
  const canManage = viewerCan(viewer, "guests.link");
  const seesFees = viewerCan(viewer, "payments.viewSheet");
  const canPublish = viewerCan(viewer, "bulletin.publish");
  const today = todayAtGym();
  const thisMonth = today.slice(0, 7);

  const state = useLoad(async () => {
    const [members, guests, visits, batches, collectedPaise, controls] =
      await Promise.all([
        listMembers(viewer),
        canManage ? listWaitingGuests() : Promise.resolve([]),
        listVisitsOn(today),
        getBatches(),
        seesFees ? getCollected(`${thisMonth}-01`, today) : Promise.resolve(0),
        canPublish ? getTodayControls() : Promise.resolve(null),
      ]);
    return { members, guests, visits, batches, collectedPaise, controls };
  }, [viewer.userId, viewer.role]);

  const firstName = (viewer.fullName || "").trim().split(/\s+/)[0];

  return (
    <section>
      <header className="page-header">
        <p className="text-sm text-muted">{todayLong()}</p>
        <h1 className="mt-0.5 page-title">
          {greeting()}
          {firstName ? `, ${firstName}` : ""}
        </h1>
      </header>
      <Loaded state={state}>
        {({ members, guests, visits, batches, collectedPaise, controls }) => {
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

          return (
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
                canAdd={viewerCan(viewer, "members.edit")}
              />
              <CrowdCard className="col-span-2" />
              {seesFees && (
                <MoneyCards
                  monthLabel={shortMonth(thisMonth)}
                  figures={{
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
              {env.vapidPublicKey && (
                <div
                  className={`flex items-center gap-3 card p-4 sm:p-5 ${canManage ? "col-span-2" : ""}`}
                >
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-control bg-canvas">
                    <NavIconSvg icon="reminders" className="size-4" />
                  </span>
                  <PushToggle vapidPublicKey={env.vapidPublicKey} compact />
                </div>
              )}
              {controls && (
                <>
                  <CloseToday controls={controls} className="col-span-2" />
                  <Notices controls={controls} className="col-span-2" />
                </>
              )}
            </div>
          );
        }}
      </Loaded>
    </section>
  );
}

const freeFill = "bg-white ring-1 ring-inset ring-ink/25";
const hatch =
  "bg-[repeating-linear-gradient(-45deg,var(--color-ink)_0_2px,rgb(12_12_13/0.25)_2px_4px)]";

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

// ---- Member home -------------------------------------------------------------

function MemberHome({ viewer }: { viewer: Viewer }) {
  const today = todayAtGym();
  const state = useLoad(async () => {
    const membership = await getOwnMembership(viewer);
    if (!membership) return null;
    const [payments, attendance] = await Promise.all([
      getMemberPayments(membership.memberId),
      getOwnAttendance(membership.memberId),
    ]);
    return { membership, payments, attendance };
  }, [viewer.userId]);

  return (
    <Loaded state={state}>
      {(loaded) => {
        if (!loaded) {
          return (
            <section className="max-w-prose">
              <h1 className="page-title">Your membership</h1>
              <p className="mt-4 text-lg">
                We couldn&apos;t find your member record. Ask at the front desk.
              </p>
              <MemberBulletin className="mt-6" />
              {/* The gym's crowd still applies to them. */}
              <CrowdCard className="mt-4" />
            </section>
          );
        }
        const { membership, payments, attendance } = loaded;
        const owedPaise = payments.ledger?.owedPaise ?? 0;
        const firstName = membership.fullName.trim().split(/\s+/)[0];
        const lastPayment = payments.history.find((entry) => !entry.void);

        return (
          <section className="mx-auto max-w-5xl">
            <header className="page-header">
              <p className="text-sm text-muted">Your membership</p>
              <h1 className="mt-0.5 page-title">Hi, {firstName}</h1>
            </header>

            <div className="mt-2 grid gap-4 split:grid-cols-2 split:items-start split:gap-6">
              <div className="space-y-4">
                <MemberCard
                  fullName={membership.fullName}
                  memberCode={membership.memberCode}
                  status={membership.status}
                  startsOn={membership.startsOn}
                  feePaise={membership.feePaise}
                  nextDue={membership.nextDue}
                  owedPaise={owedPaise}
                />
                <CheckInTile checkedInAt={attendance.today} />
                <VisitCharts
                  visits={attendance.visits.map((visit) => visit.gymDate)}
                  today={today}
                />
              </div>

              <div className="space-y-4">
                <CrowdCard />
                <MemberBulletin />
                <FeeReminders
                  status={membership.status}
                  allowed={membership.remindersAllowed}
                />
                {owedPaise > 0 && (
                  <p className="flex items-center gap-3 card-dark p-4 sm:px-6">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-control bg-white/10">
                      <NavIconSvg icon="rupee" className="size-5" />
                    </span>
                    <span>
                      <span className="block text-lg font-semibold tabular-nums">
                        {formatPaise(owedPaise)} due
                      </span>
                      <span className="block text-sm text-white/65">
                        Pay at the front desk
                      </span>
                    </span>
                  </p>
                )}
                <Disclosure
                  title="Payments"
                  summary={
                    lastPayment
                      ? `Last ${formatPaise(lastPayment.amountPaise)} · ${formatShortDate(lastPayment.paidOn, today)}`
                      : "None yet"
                  }
                  icon="payments"
                >
                  <PaymentHistory
                    history={payments.history}
                    canVoid={false}
                    today={today}
                  />
                </Disclosure>
              </div>
            </div>
          </section>
        );
      }}
    </Loaded>
  );
}

function CheckInTile({ checkedInAt }: { checkedInAt: Date | null }) {
  if (checkedInAt) {
    return (
      <p className="flex items-center gap-3 card p-4 sm:px-6">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-ink text-white">
          <NavIconSvg icon="check" className="size-5" />
        </span>
        <span className="min-w-0">
          <span className="block font-semibold tracking-tight">In today</span>
          <span className="block text-sm text-muted">
            Checked in at {formatTime(checkedInAt)}
          </span>
        </span>
      </p>
    );
  }
  return (
    <Link
      href="/app/check-in"
      className="flex items-center gap-3 card p-4 transition-colors hover:bg-canvas/40 sm:px-6"
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-canvas">
        <NavIconSvg icon="qr" className="size-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold tracking-tight">
          Not in yet today
        </span>
        <span className="block text-sm text-muted">Scan the desk code</span>
      </span>
      <span className="btn-dark min-h-10 px-4">Check in</span>
    </Link>
  );
}

function FeeReminders({
  status,
  allowed,
}: {
  status: MembershipStatus;
  allowed: boolean;
}) {
  if (!env.vapidPublicKey || status === "free" || status === "inactive")
    return null;

  return (
    <div className="flex items-center gap-3 card p-4 sm:px-6">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-control bg-canvas">
        <NavIconSvg icon="reminders" className="size-5" />
      </span>
      {allowed ? (
        <div className="min-w-0 flex-1">
          <PushToggle vapidPublicKey={env.vapidPublicKey} compact />
        </div>
      ) : (
        <p className="min-w-0 text-sm">
          <span className="block font-semibold">Fee reminders off</span>
          <span className="block text-muted">Ask at the front desk</span>
        </p>
      )}
    </div>
  );
}
