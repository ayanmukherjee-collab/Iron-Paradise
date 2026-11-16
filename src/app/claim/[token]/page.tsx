import type { Metadata } from "next";
import Link from "@/components/ui/link";
import { getViewer } from "@/auth/session";
import { LogoMark } from "@/components/brand/logo-mark";
import { ClaimForm } from "@/members/components/claim-form";

export const metadata: Metadata = {
  title: "Claim your membership",
  robots: { index: false },
  referrer: "no-referrer",
};

// Public on purpose: a member opening the link from WhatsApp may not be signed
// in yet. Nothing about the member is shown until the token is redeemed.
export default async function ClaimPage({
  params,
}: PageProps<"/claim/[token]">) {
  const { token } = await params;
  const viewer = await getViewer();
  const returnTo = `/claim/${encodeURIComponent(token)}`;

  return (
    <main className="flex min-h-svh flex-col items-center justify-center bg-charcoal px-4 py-16 text-center text-white">
      <LogoMark className="h-16 w-auto" />
      <h1 className="mt-8 display text-5xl">Your membership</h1>

      {!viewer ? (
        <>
          <p className="mt-4 max-w-sm text-lg text-mist">
            The gym sent you this link. Sign in with Google and it will be
            connected to your membership.
          </p>
          <Link
            href={`/sign-in?next=${encodeURIComponent(returnTo)}`}
            className="mt-8 inline-flex min-h-12 items-center bg-white px-6 text-sm font-bold tracking-[0.08em] text-ink uppercase hover:bg-mist"
          >
            Sign in to continue
          </Link>
        </>
      ) : viewer.role !== "guest" ? (
        <>
          <p className="mt-4 max-w-sm text-lg text-mist">
            This account is already set up. If the link was meant for someone
            else, pass it on.
          </p>
          <Link
            href="/app"
            className="mt-8 font-semibold underline underline-offset-4"
          >
            Go to the app
          </Link>
        </>
      ) : (
        <>
          <p className="mt-4 max-w-sm text-lg text-mist">
            Signed in as{" "}
            <strong className="break-all text-white">{viewer.email}</strong>.
            Connect this account to your gym membership?
          </p>
          <ClaimForm token={token} />
        </>
      )}
    </main>
  );
}
