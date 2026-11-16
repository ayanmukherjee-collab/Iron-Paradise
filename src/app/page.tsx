import type { Viewport } from "next";
import { Inter } from "next/font/google";
import { hours } from "@/content/landing";
import { Closing, SiteFooter } from "@/landing/components/closing";
import { Hero, QuickActions, SiteHeader } from "@/landing/components/hero";
import { Facilities, Hours, Plans } from "@/landing/components/sections";
import { Visit } from "@/landing/components/visit";
import { gymNow, openStatus } from "@/landing/open-status";

// The same typeface as the signed-in app, so the two feel like one product.
const inter = Inter({ subsets: ["latin"], display: "swap" });

export const viewport: Viewport = {
  themeColor: "#0c0c0d",
};

export default function LandingPage() {
  // Rendered per request (see app/layout.tsx), so "open now" is current.
  const now = gymNow(new Date());
  const status = openStatus(hours.rows, now, hours.closedDays);

  return (
    <div className={`${inter.className} min-h-svh bg-ink text-white`}>
      <SiteHeader />
      <main className="mx-auto flex max-w-6xl flex-col gap-3 px-3 sm:px-4 md:gap-4">
        <Hero status={status} />
        <QuickActions />
        <Facilities />
        <Hours status={status} now={now} />
        <Plans />
        <Visit />
        <Closing />
      </main>
      <SiteFooter />
    </div>
  );
}
