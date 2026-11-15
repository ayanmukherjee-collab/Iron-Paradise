import Link from "next/link";
import { isStaff, roleLabels } from "@/auth/permissions";
import { requireViewer, viewerCan, type Viewer } from "@/auth/session";

export default async function AppHome() {
  const viewer = await requireViewer("/app");

  if (!viewer.isActive) return <AccountSwitchedOff />;
  if (viewer.role === "guest") return <WaitingForGym email={viewer.email} />;
  if (isStaff(viewer.role)) return <StaffHome viewer={viewer} />;
  return <MemberHome />;
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

function StaffHome({ viewer }: { viewer: Viewer }) {
  return (
    <section className="max-w-prose">
      <h1 className="display text-5xl">Front desk</h1>
      <p className="mt-4 text-lg">
        You&apos;re signed in as {roleLabels[viewer.role].toLowerCase()}.
        Members, payments and attendance arrive here as each part of the app is
        finished.
      </p>
      {viewerCan(viewer, "roles.change") && (
        <p className="mt-6 text-lg">
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

function MemberHome() {
  return (
    <section className="max-w-prose">
      <h1 className="display text-5xl">Your membership</h1>
      <p className="mt-4 text-lg">
        Your plan, visits and payments will show up here. Check-in by QR code at
        the desk is on the way.
      </p>
    </section>
  );
}
