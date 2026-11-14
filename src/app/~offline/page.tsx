import type { Metadata } from "next";
import { LogoMark } from "@/components/brand/logo-mark";

export const metadata: Metadata = {
  title: "Offline",
  robots: { index: false },
};

export default function OfflinePage() {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center bg-charcoal px-4 text-center text-white">
      <LogoMark className="h-16 w-auto" />
      <h1 className="mt-8 display text-5xl">No signal</h1>
      <p className="mt-4 max-w-sm text-lg text-mist">
        This phone is offline. Get back on Wi-Fi or mobile data and the app
        picks up where you left off.
      </p>
    </main>
  );
}
