import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "@/components/ui/link";
import { redirect } from "next/navigation";
import { SignInForm } from "@/auth/components/sign-in-form";
import { getViewer } from "@/auth/session";
import { LogoMark } from "@/components/brand/logo-mark";
import { publicEnv } from "@/lib/env";
import { safeReturnPath } from "@/lib/request";

export const metadata: Metadata = {
  title: "Sign in",
  robots: { index: false },
};

export default async function SignInPage({
  searchParams,
}: PageProps<"/sign-in">) {
  const params = await searchParams;
  const returnTo = safeReturnPath(params.next);

  if (await getViewer()) redirect(returnTo);

  const nonce = (await headers()).get("x-nonce") ?? undefined;
  const callbackFailed = params.error === "callback";

  return (
    <main className="flex min-h-svh flex-col items-center justify-center bg-charcoal px-4 py-16 text-center text-white">
      <Link href="/" aria-label="Iron Paradise home">
        <LogoMark className="h-16 w-auto" />
      </Link>
      <h1 className="mt-8 display text-5xl">Sign in</h1>
      <p className="mt-4 max-w-sm text-lg text-mist">
        Members and staff use their Google account. New here? Sign in once and
        the front desk will link you to your membership.
      </p>
      {callbackFailed && (
        <p
          role="alert"
          className="mt-6 max-w-sm border-l-4 border-white pl-3 text-left"
        >
          Sign-in didn&apos;t finish. Give it another go.
        </p>
      )}
      <SignInForm
        returnTo={returnTo}
        turnstileSiteKey={publicEnv().NEXT_PUBLIC_TURNSTILE_SITE_KEY}
        nonce={nonce}
      />
      <p className="mt-6 max-w-sm text-sm text-mist">
        By signing in you agree to our{" "}
        <Link href="/terms" className="underline underline-offset-4">
          terms
        </Link>{" "}
        and{" "}
        <Link href="/privacy" className="underline underline-offset-4">
          privacy policy
        </Link>
        .
      </p>
      <Link
        href="/"
        className="mt-10 font-semibold underline underline-offset-4"
      >
        Back to the home page
      </Link>
    </main>
  );
}
