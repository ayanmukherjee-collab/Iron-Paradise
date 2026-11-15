import type { Metadata } from "next";
import Link from "next/link";
import type { Action } from "@/auth/permissions";
import { roleLabels } from "@/auth/permissions";
import { requireViewer, viewerCan } from "@/auth/session";
import { signOut } from "@/auth/sign-in-actions";
import { LogoMark } from "@/components/brand/logo-mark";
import { BottomNav, type NavItem } from "@/components/nav/bottom-nav";
import type { NavIcon } from "@/components/nav/nav-icons";
import { InstallGuide } from "@/pwa/install-guide";

export const metadata: Metadata = {
  title: { default: "Home", template: "%s | Iron Paradise" },
  robots: { index: false },
};

interface Section {
  href: string;
  label: string;
  permission: Action;
  /** Sections with an icon get their own tab on phones; the rest go under More. */
  icon?: NavIcon;
}

// Each link appears only for roles that can use the page behind it.
const sections: Section[] = [
  {
    href: "/app/members",
    label: "Members",
    permission: "members.view",
    icon: "members",
  },
  {
    href: "/app/guests",
    label: "Guests",
    permission: "guests.link",
    icon: "guests",
  },
  { href: "/app/team", label: "Team", permission: "roles.change" },
  { href: "/app/audit", label: "Audit", permission: "audit.view" },
  { href: "/app/settings", label: "Settings", permission: "plans.edit" },
];

export default async function AppLayout({ children }: LayoutProps<"/app">) {
  const viewer = await requireViewer("/app");
  const links = sections.filter((section) =>
    viewerCan(viewer, section.permission),
  );
  const tabs: NavItem[] = [
    { href: "/app", label: "Home", icon: "home" },
    ...links.flatMap((link) =>
      link.icon
        ? [{ href: link.href, label: link.label, icon: link.icon }]
        : [],
    ),
  ];
  const more = links
    .filter((link) => !link.icon)
    .map(({ href, label }) => ({ href, label }));

  return (
    <div className="flex min-h-svh flex-col pb-24 sm:pb-0">
      <header className="bg-charcoal text-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
          <Link
            href="/app"
            className="flex items-center gap-3"
            aria-label="Iron Paradise app home"
          >
            <LogoMark className="h-9 w-auto" />
            <span className="display text-2xl">Iron Paradise</span>
          </Link>
          <form action={signOut} className="hidden sm:block">
            <button
              type="submit"
              className="min-h-12 text-sm font-bold tracking-[0.08em] uppercase underline underline-offset-4"
            >
              Sign out
            </button>
          </form>
        </div>
        {links.length > 0 && (
          <nav
            aria-label="Sections"
            className="hidden border-t border-ash sm:block"
          >
            <ul className="mx-auto flex max-w-5xl gap-6 px-4 text-sm font-bold tracking-[0.08em] uppercase">
              <li>
                <Link href="/app" className="inline-flex min-h-12 items-center">
                  Home
                </Link>
              </li>
              {links.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="inline-flex min-h-12 items-center"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        )}
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
        <p className="mb-6 text-sm text-smoke">
          {viewer.fullName || viewer.email} · {roleLabels[viewer.role]}
        </p>
        {children}
      </main>
      <InstallGuide />
      <BottomNav items={tabs} more={more} signOut={signOut} />
    </div>
  );
}
