// The public site: landing page and legal pages. The legal pages are the
// Next.js ones as they are (plain components); the landing page drops
// next/font, which the static app replaces with self-hosted fonts.
import { useEffect } from "react";
import { gym, hours } from "@/content/landing";
import { Closing, SiteFooter } from "@/landing/components/closing";
import { Hero, QuickActions, SiteHeader } from "@/landing/components/hero";
import { Facilities, Hours, Plans } from "@/landing/components/sections";
import { Visit } from "@/landing/components/visit";
import { gymNow, openStatus } from "@/landing/open-status";
import { PrivacyPage as Privacy } from "@/legal/privacy-page";
import { TermsPage as Terms } from "@/legal/terms-page";
import { useTitle } from "../data/use-load";

/** Mirrors src/app/page.tsx. */
export function LandingPage({ now = new Date() }: { now?: Date }) {
  useEffect(() => {
    document.title = `${gym.fullName} | Paradise is earned`;
  }, []);
  const gymTime = gymNow(now);
  const status = openStatus(hours.rows, gymTime, hours.closedDays);

  return (
    <div className="font-app min-h-svh bg-ink text-white">
      <SiteHeader />
      <main className="mx-auto flex max-w-6xl flex-col gap-3 px-3 sm:px-4 md:gap-4">
        <Hero status={status} />
        <QuickActions />
        <Facilities />
        <Hours status={status} now={gymTime} />
        <Plans />
        <Visit />
        <Closing />
      </main>
      <SiteFooter />
    </div>
  );
}

export function PrivacyPage() {
  useTitle("Privacy policy");
  return <Privacy />;
}

export function TermsPage() {
  useTitle("Terms of use");
  return <Terms />;
}
