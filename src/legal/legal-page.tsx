import Link from "@/components/ui/link";
import type { ReactNode } from "react";
import { LogoMark } from "@/components/brand/logo-mark";
import { gym } from "@/content/landing";

/** Shared layout for the privacy policy and terms: plain, readable, public. */
export function LegalPage({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-svh bg-paper text-ink">
      <header className="bg-charcoal text-white">
        <div className="mx-auto flex max-w-3xl items-center px-4 py-4 md:px-8">
          <Link
            href="/"
            className="flex items-center gap-2.5"
            aria-label={`${gym.fullName} home`}
          >
            <LogoMark className="h-7 w-auto" />
            <span className="font-display text-lg tracking-wide uppercase">
              {gym.fullName}
            </span>
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-12 md:px-8">
        <h1 className="display text-5xl md:text-6xl">{title}</h1>
        <p className="mt-3 text-smoke">Last updated {updated}</p>
        <div className="mt-10 space-y-8 text-lg leading-relaxed [&_a]:font-semibold [&_a]:underline [&_a]:underline-offset-4 [&_h2]:font-display [&_h2]:text-3xl [&_h2]:tracking-wide [&_h2]:uppercase [&_li]:mt-2 [&_p]:mt-3 [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:pl-6">
          {children}
        </div>
        <nav
          aria-label="Legal"
          className="mt-16 flex flex-wrap gap-x-6 gap-y-3 border-t border-ink/15 pt-6 text-smoke"
        >
          <Link href="/" className="hover:text-ink">
            Home
          </Link>
          <Link href="/privacy" className="hover:text-ink">
            Privacy policy
          </Link>
          <Link href="/terms" className="hover:text-ink">
            Terms of use
          </Link>
        </nav>
      </main>
    </div>
  );
}

/** How to reach the gym about the app or your data. */
export function ContactLines({
  phoneDisplay,
  phoneHref,
  addressLines,
}: {
  phoneDisplay: string;
  phoneHref: string;
  addressLines: string[];
}) {
  return (
    <ul>
      <li>At the front desk, in person.</li>
      <li>
        By phone or WhatsApp: <a href={phoneHref}>{phoneDisplay}</a>
      </li>
      <li>By post: {addressLines.join(", ")}</li>
    </ul>
  );
}
