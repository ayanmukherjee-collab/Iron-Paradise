import Link from "next/link";
import type { ReactNode } from "react";
import { isStaff } from "@/auth/permissions";
import { requireViewer, viewerCan, type Viewer } from "@/auth/session";
import { formatDate } from "@/lib/dates";
import { formatPaise } from "@/lib/money";
import { StatusBadge } from "@/members/components/status-badge";
import {
  getOwnMembership,
  listMembers,
  listWaitingGuests,
} from "@/members/queries";

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
  const [members, guests] = await Promise.all([
    listMembers(viewer),
    canManage ? listWaitingGuests(viewer) : Promise.resolve([]),
  ]);
  const current = members.filter(
    (member) => member.status !== "inactive",
  ).length;
  const quiet = members.filter((member) => member.goneQuiet).length;

  return (
    <section>
      <h1 className="display text-5xl">Front desk</h1>
      <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Tile href="/app/members" figure={current} label="Current members" />
        {canManage && (
          <>
            <Tile href="/app/members/new" figure="+" label="Add a member" />
            <Tile
              href="/app/guests"
              figure={guests.length}
              label="Waiting guests"
            />
            <Tile
              href="/app/members?filter=quiet"
              figure={quiet}
              label="Gone quiet"
            />
          </>
        )}
      </ul>
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
    </section>
  );
}

function Tile({
  href,
  figure,
  label,
}: {
  href: string;
  figure: ReactNode;
  label: string;
}) {
  return (
    <li>
      <Link
        href={href}
        className="block border-2 border-ink bg-white p-5 hover:bg-ink hover:text-white"
      >
        <span className="block display text-5xl">{figure}</span>
        <span className="mt-2 block font-semibold">{label}</span>
      </Link>
    </li>
  );
}

async function MemberHome({ viewer }: { viewer: Viewer }) {
  const membership = await getOwnMembership(viewer);

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
      <p className="mt-8 text-smoke">
        Your visits and payments will show here soon.
      </p>
    </section>
  );
}
