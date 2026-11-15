import type { Metadata } from "next";
import Link from "next/link";
import { roleLabels } from "@/auth/permissions";
import { requireViewer, viewerCan } from "@/auth/session";
import { signOut } from "@/auth/sign-in-actions";
import { LogoMark } from "@/components/brand/logo-mark";
import { InstallGuide } from "@/pwa/install-guide";

export const metadata: Metadata = {
  title: { default: "Home", template: "%s | Iron Paradise" },
  robots: { index: false },
};

export default async function AppLayout({ children }: LayoutProps<"/app">) {
  const viewer = await requireViewer("/app");
  const showTeam = viewerCan(viewer, "roles.change");

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
          <nav className="flex items-center gap-5 text-sm font-bold tracking-[0.08em] uppercase">
            <Link href="/app" className="min-h-12 content-center">
              Home
            </Link>
            {showTeam && (
              <Link href="/app/team" className="min-h-12 content-center">
                Team
              </Link>
            )}
            <form action={signOut}>
              <button
                type="submit"
                className="min-h-12 tracking-[0.08em] uppercase underline underline-offset-4"
              >
                Sign out
              </button>
            </form>
          </nav>
        </div>
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
