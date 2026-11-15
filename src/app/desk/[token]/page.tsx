import type { Metadata } from "next";
import { headers } from "next/headers";
import { DeskScreen } from "@/attendance/components/desk-screen";
import { LogoMark } from "@/components/brand/logo-mark";
import { isProduction, publicEnv } from "@/lib/env";
import { appOrigin } from "@/lib/request";

export const metadata: Metadata = {
  title: "Desk check-in",
  robots: { index: false, follow: false },
  // The secret link must never leak through a Referer header.
  referrer: "no-referrer",
};

// Public on purpose: the desk device holds no account. It can show the
// rotating QR and nothing else; the code endpoint checks the link.
export default async function DeskPage({ params }: PageProps<"/desk/[token]">) {
  const { token } = await params;
  const origin = appOrigin(
    await headers(),
    publicEnv().NEXT_PUBLIC_SITE_URL,
    isProduction,
  );

  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-8 bg-charcoal px-4 py-8 text-white">
      <div className="flex items-center gap-4">
        <LogoMark className="h-12 w-auto" />
        <p className="display text-4xl">Scan to check in</p>
      </div>
      <DeskScreen token={token} origin={origin} />
      <p className="max-w-md text-center text-lg text-mist">
        Open the Iron Paradise app, tap <strong>Check in</strong>, and point
        your camera here.
      </p>
    </main>
  );
}
