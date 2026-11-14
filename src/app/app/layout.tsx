import type { Metadata } from "next";
import Link from "next/link";
import type { Action } from "@/auth/permissions";
import { roleLabels } from "@/auth/permissions";
import { requireViewer, viewerCan } from "@/auth/session";
import { signOut } from "@/auth/sign-in-actions";
import { LogoMark } from "@/components/brand/logo-mark";
import { InstallGuide } from "@/pwa/install-guide";

export const metadata: Metadata = {
  title: { default: "Home", template: "%s | Iron Paradise" },
  robots: { index: false },
};

// Each link appears only for roles that can use the page behind it.
const sections: { href: string; label: string; permission: Action }[] = [
  { href: "/app/members", label: "Members", permission: "members.view" },
  { href: "/app/guests", label: "Guests", permission: "guests.link" },
  { href: "/app/team", label: "Team", permission: "roles.change" },
  { href: "/app/audit", label: "Audit", permission: "audit.view" },
  { href: "/app/settings", label: "Settings", permission: "plans.edit" },
];

export default async function AppLayout({ children }: LayoutProps<"/app">) {
  const viewer = await requireViewer("/app");
  const links = sections.filter((section) =>
    viewerCan(viewer, section.permission),
  );

  return (
    <div className="flex min-h-svh flex-col">
      <header className="bg-charcoal text-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
          <Link
            href="/app"
            className="flex items-center gap-3"
            aria-label="Iron Paradise app home"
          >
            <LogoMark className="h-9 w-auto" />
            <span className="hidden display text-2xl sm:inline">
              Iron Paradise
            </span>
          </Link>
          <form action={signOut}>
            <button
              type="submit"
              className="min-h-12 text-sm font-bold tracking-[0.08em] uppercase underline underline-offset-4"
            >
              Sign out
            </button>
          </form>
        </div>
        {links.length > 0 && (
          <nav aria-label="Sections" className="border-t border-ash">
            <ul className="mx-auto flex max-w-5xl gap-6 overflow-x-auto px-4 text-sm font-bold tracking-[0.08em] uppercase">
              <li>
                <Link
                  href="/app"
                  className="inline-flex min-h-12 items-center whitespace-nowrap"
                >
                  Home
                </Link>
              </li>
              {links.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="inline-flex min-h-12 items-center whitespace-nowrap"
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
    </div>
  );
}
