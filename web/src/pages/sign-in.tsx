import { useEffect, useState } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router";
import { LogoMark } from "@/components/brand/logo-mark";
import { Button } from "@/components/ui/button";
import Link from "@/components/ui/link";
import { safeReturnPath } from "@/lib/request";
import { useViewerState } from "../auth/viewer";
import { supabase } from "../lib/supabase";

/**
 * Google sign-in, started on the phone. Google sends the person back to
 * /auth/callback with a one-time code (PKCE). Turnstile and the IP rate limit
 * the server used are gone: there's no server to protect any more, a Google
 * sign-in can't be scripted, and Supabase Auth limits sign-in attempts itself.
 */
export function SignInPage() {
  const [params] = useSearchParams();
  const returnTo = safeReturnPath(params.get("next"));
  const state = useViewerState();
  const [error, setError] = useState<string | null>(
    params.get("error") === "callback"
      ? "Sign-in didn't finish. Give it another go."
      : null,
  );
  const [pending, setPending] = useState(false);

  useEffect(() => {
    document.title = "Sign in | Iron Paradise";
  }, []);

  if (state.status === "ready") return <Navigate to={returnTo} replace />;

  async function start() {
    setPending(true);
    setError(null);
    const callback = new URL("/auth/callback", window.location.origin);
    callback.searchParams.set("next", returnTo);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: callback.toString() },
    });
    // On success the browser is already on its way to Google.
    if (error) {
      setPending(false);
      setError("Google sign-in is unavailable right now. Try again shortly.");
    }
  }

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
      <div className="mt-10 flex w-full max-w-sm flex-col items-center gap-5">
        <Button
          type="button"
          variant="light"
          onClick={start}
          disabled={pending}
          className="w-full"
        >
          <GoogleMark />
          {pending ? "Opening Google…" : "Continue with Google"}
        </Button>
        {error && (
          <p
            role="alert"
            className="border-l-4 border-white pl-3 text-left text-base text-white"
          >
            {error}
          </p>
        )}
      </div>
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
    </main>
  );
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
      <path
        fill="currentColor"
        d="M21.35 11.1H12v2.98h5.35c-.23 1.4-1.66 4.1-5.35 4.1-3.22 0-5.85-2.67-5.85-5.95S8.78 6.28 12 6.28c1.83 0 3.06.78 3.76 1.45l2.56-2.47C16.68 3.74 14.55 2.8 12 2.8 6.92 2.8 2.8 6.92 2.8 12s4.12 9.2 9.2 9.2c5.31 0 8.83-3.73 8.83-8.99 0-.6-.07-1.06-.15-1.51Z"
      />
    </svg>
  );
}

/**
 * Where Google sends the person back. The Supabase client swaps the code in
 * the address for a session as it starts up (detectSessionInUrl); this screen
 * waits for that and moves on.
 */
export function AuthCallbackPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const returnTo = safeReturnPath(params.get("next"));

  useEffect(() => {
    let cancelled = false;
    void supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      navigate(data.session ? returnTo : "/sign-in?error=callback", {
        replace: true,
      });
    });
    return () => {
      cancelled = true;
    };
  }, [navigate, returnTo]);

  return (
    <main className="flex min-h-svh items-center justify-center bg-charcoal text-white">
      <p role="status" className="display text-3xl">
        Signing you in…
      </p>
    </main>
  );
}
