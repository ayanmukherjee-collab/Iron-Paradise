import type { Metadata } from "next";
import Link from "next/link";
import { LogoMark } from "@/components/brand/logo-mark";

export const metadata: Metadata = {
  title: "Sign in",
  robots: { index: false },
};

// Google sign-in lands in Phase 1 (Supabase Auth). Until then this page stops
// the landing page's sign-in links from hitting a 404.
export default function SignInPage() {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center bg-charcoal px-4 text-center text-white">
      <LogoMark className="h-16 w-auto" />
      <h1 className="mt-8 display text-5xl">Member sign in</h1>
      <p className="mt-4 max-w-sm text-lg text-mist">
        Online sign in isn&apos;t open yet. Ask at the front desk and we&apos;ll
        sort you out.
      </p>
      <Link
        href="/"
        className="mt-8 font-semibold underline underline-offset-4"
      >
        Back to the home page
      </Link>
    </main>
  );
}
