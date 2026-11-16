import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import Link from "@/components/ui/link";
import type { Action } from "@/auth/permissions";
import { roleLabels } from "@/auth/permissions";
import { requireViewer, viewerCan } from "@/auth/session";
import { signOut } from "@/auth/sign-in-actions";
import { LogoMark } from "@/components/brand/logo-mark";
import { BottomNav, type NavItem } from "@/components/nav/bottom-nav";
import type { NavIcon } from "@/components/nav/nav-icons";
import { SideNav } from "@/components/nav/side-nav";
import { InstallGuide } from "@/pwa/install-guide";

// The app's typeface. Loaded here rather than in the root layout so the
// public site doesn't download it.
const inter = Inter({ subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  title: { default: "Home", template: "%s | Iron Paradise" },
  robots: { index: false },
};

export const viewport: Viewport = {
  themeColor: "#ebebed",
};

interface Section {
  href: string;
  label: string;
  permission: Action;
  icon: NavIcon;
  /** Tabs get their own slot in the phone bar; the rest go under More. */
  tab?: boolean;
}

// Each link appears only for roles that can use the page behind it.
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

function Brand({ size = "text-2xl" }: { size?: string }) {
  return (
    <Link
      href="/app"
      className="flex items-center gap-2.5"
      aria-label="Iron Paradise app home"
    >
      <LogoMark className="h-8 w-auto" />
      <span className={`display ${size} leading-none`}>Iron Paradise</span>
    </Link>
  );
}

export default async function AppLayout({ children }: LayoutProps<"/app">) {
  const viewer = await requireViewer("/app");
  const links = sections.filter((section) =>
    viewerCan(viewer, section.permission),
  );
  const home: NavItem = { href: "/app", label: "Home", icon: "home" };
  // Staff who also train here check in from their home screen; a member's
  // bar has room for it.
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

  // Guests and switched-off accounts have nowhere to go yet: their home
  // screen stands alone, with no navigation around it.
  if (viewer.role === "guest" || !viewer.isActive) {
    return (
      <div className={`${inter.className} min-h-svh text-ink app-canvas`}>
        <main className="mx-auto flex min-h-svh w-full max-w-md flex-col px-4 pt-[calc(1rem+env(safe-area-inset-top))] pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
          {children}
        </main>
        <InstallGuide />
      </div>
    );
  }

  return (
    <div className={`${inter.className} min-h-svh text-ink app-canvas`}>
      <div className="mx-auto flex max-w-[92rem] gap-4 lg:p-4">
        <SideNav
          brand={<Brand />}
          primary={tabs}
          secondary={more}
          person={{ name, role: roleLabels[viewer.role] }}
          signOut={signOut}
        />
        <div className="min-w-0 flex-1">
          {/* No app bar on phones: each page's own title is the header. */}
          <main className="mx-auto w-full max-w-6xl px-4 pt-[calc(1.25rem+env(safe-area-inset-top))] pb-[calc(7.5rem+env(safe-area-inset-bottom))] sm:px-6 lg:px-4 lg:pt-4 lg:pb-12">
            {children}
          </main>
        </div>
      </div>
      <InstallGuide />
      <BottomNav items={tabs} more={more} signOut={signOut} />
    </div>
  );
}
