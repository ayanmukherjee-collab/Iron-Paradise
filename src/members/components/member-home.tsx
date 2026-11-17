import Link from "@/components/ui/link";
import { VisitCharts } from "@/attendance/components/visit-charts";
import { getOwnAttendance } from "@/attendance/queries";
import type { Viewer } from "@/auth/session";
import { CrowdCard } from "@/bulletin/components/crowd-card";
import { MemberBulletin } from "@/bulletin/components/member-bulletin";
import { NavIconSvg } from "@/components/nav/nav-icons";
import { Disclosure } from "@/components/ui/disclosure";
import { formatShortDate, formatTime, todayAtGym } from "@/lib/dates";
import { formatPaise } from "@/lib/money";
import type { MembershipStatus } from "@/members/billing";
import { MemberCard } from "@/members/components/member-card";
import { getOwnMembership } from "@/members/queries";
import { vapidKeys } from "@/notifications/channels";
import { PushToggle } from "@/notifications/components/push-toggle";
import { PaymentHistory } from "@/payments/components/payment-history";
import { getMemberPayments } from "@/payments/queries";

/**
 * A member's home: their card, today's check-in, the gym's bulletin and
 * their attendance as charts, with reminders and payments below. One
 * column on a phone; two side by side on a wide screen.
 */
export async function MemberHome({ viewer }: { viewer: Viewer }) {
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
        <MemberBulletin className="mt-6" />
        <CrowdCard className="mt-4" />
      </section>
    );
  }

  const [payments, attendance] = await Promise.all([
    getMemberPayments(viewer, membership.memberId),
    getOwnAttendance(viewer, membership.memberId),
  ]);
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
          <MemberBulletin />
          <CrowdCard />
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
}

/** In today (with the time), or a big button to check in. */
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
  const keys = vapidKeys();
  if (!keys || status === "free" || status === "inactive") return null;

  return (
    <div className="flex items-center gap-3 card p-4 sm:px-6">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-control bg-canvas">
        <NavIconSvg icon="reminders" className="size-5" />
      </span>
      {allowed ? (
        <div className="min-w-0 flex-1">
          <PushToggle vapidPublicKey={keys.publicKey} compact />
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
