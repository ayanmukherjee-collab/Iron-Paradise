import { Outlet } from "react-router";
import type { Action } from "@/auth/permissions";
import { roleLabels } from "@/auth/permissions";
import { LogoMark } from "@/components/brand/logo-mark";
import { BottomNav, type NavItem } from "@/components/nav/bottom-nav";
import { MemberNav } from "@/components/nav/member-nav";
import type { NavIcon } from "@/components/nav/nav-icons";
import { SideNav } from "@/components/nav/side-nav";
import Link from "@/components/ui/link";
import { InstallGuide } from "@/pwa/install-guide";
import { signOut, useViewer, viewerCan } from "./auth/viewer";

// Mirrors src/app/app/layout.tsx; the nav components are shared as they are.

interface Section {
  href: string;
  label: string;
  permission: Action;
  icon: NavIcon;
  /** Tabs get their own slot in the phone bar; the rest go under More. */
  tab?: boolean;
}

const sections: Section[] = [
  {
    href: "/app/members",
    label: "Members",
    permission: "members.view",
    icon: "members",
    tab: true,
  },
  {
    href: "/app/payments",
    label: "Payments",
    permission: "payments.viewSheet",
    icon: "payments",
    tab: true,
  },
  {
    href: "/app/attendance",
    label: "Attendance",
    permission: "attendance.view",
    icon: "attendance",
    tab: true,
  },
  {
    href: "/app/reminders",
    label: "Reminders",
    permission: "reminders.send",
    icon: "reminders",
  },
  {
    href: "/app/guests",
    label: "Guests",
    permission: "guests.link",
    icon: "guests",
  },
  {
    href: "/app/team",
    label: "Team",
    permission: "roles.change",
    icon: "team",
  },
  {
    href: "/app/audit",
    label: "Audit",
    permission: "audit.view",
    icon: "audit",
  },
  {
    href: "/app/settings",
    label: "Settings",
    permission: "plans.edit",
    icon: "settings",
  },
];

function Brand() {
  return (
    <Link
      href="/app"
      className="flex items-center gap-2.5"
      aria-label="Iron Paradise app home"
    >
      <LogoMark className="h-8 w-auto" />
      <span className="display text-2xl leading-none">Iron Paradise</span>
    </Link>
  );
}

export function AppShell() {
  const viewer = useViewer();
  const links = sections.filter((section) =>
    viewerCan(viewer, section.permission),
  );
  const home: NavItem = { href: "/app", label: "Home", icon: "home" };
  const checkIn: NavItem[] =
    viewer.role === "member" && viewerCan(viewer, "self.checkIn")
      ? [{ href: "/app/check-in", label: "Check in", icon: "checkIn" }]
      : [];
  const tabs: NavItem[] = [
    home,
    ...links
      .filter((link) => link.tab)
      .map(({ href, label, icon }) => ({ href, label, icon })),
    ...checkIn,
  ];
  const more: NavItem[] = links
    .filter((link) => !link.tab)
    .map(({ href, label, icon }) => ({ href, label, icon }));
  const name = viewer.fullName || viewer.email || "You";

  if (viewer.role === "guest" || !viewer.isActive) {
    return (
      <div className="font-app min-h-svh text-ink app-canvas">
        <main className="mx-auto flex min-h-svh w-full max-w-md flex-col px-4 pt-[calc(1rem+env(safe-area-inset-top))] pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
          <Outlet />
        </main>
        <InstallGuide />
      </div>
    );
  }

  return (
    <div className="font-app min-h-svh text-ink app-canvas">
      <div className="mx-auto flex max-w-[92rem] gap-4 lg:p-4">
        <SideNav
          brand={<Brand />}
          primary={tabs}
          secondary={more}
          person={{ name, role: roleLabels[viewer.role] }}
          signOut={signOut}
        />
        <div className="min-w-0 flex-1">
          <main className="mx-auto w-full max-w-6xl px-4 pt-[calc(1.25rem+env(safe-area-inset-top))] pb-[calc(7.5rem+env(safe-area-inset-bottom))] sm:px-6 lg:px-4 lg:pt-4 lg:pb-12">
            <Outlet />
          </main>
        </div>
      </div>
      <InstallGuide />
      {viewer.role === "member" ? (
        <MemberNav
          home={home}
          checkIn={checkIn[0] ?? null}
          more={more}
          person={{ name, role: roleLabels[viewer.role] }}
          signOut={signOut}
        />
      ) : (
        <BottomNav items={tabs} more={more} signOut={signOut} />
      )}
    </div>
  );
}

/**
 * Screens not rebuilt yet (docs/static-rebuild.md, steps 2–7). Only seen on
 * the rebuild branch; production keeps the old app until the cutover.
 */
export function NotRebuiltYet() {
  return (
    <section className="max-w-prose space-y-4">
      <header className="page-header">
        <h1 className="page-title">Coming over next</h1>
      </header>
      <p className="text-lg">
        This screen hasn&apos;t moved to the new app yet. Check in works.
      </p>
      <Link
        href="/app/check-in"
        className="inline-flex font-semibold underline decoration-line underline-offset-4 hover:decoration-ink"
      >
        Go to Check in
      </Link>
    </section>
  );
}
