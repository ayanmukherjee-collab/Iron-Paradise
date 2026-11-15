"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { isProduction, publicEnv } from "@/lib/env";
import { takeRateLimit } from "@/lib/rate-limit";
import { appOrigin, clientIp, safeReturnPath } from "@/lib/request";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { verifyTurnstile } from "@/lib/turnstile";

export interface SignInState {
  error: string | null;
}

// Public by design: this is how a signed-out person starts signing in. It is
// guarded by a rate limit and Turnstile instead of a session check. Google
// sign-in creates the account on first use, so this is also the sign-up path.
export async function startGoogleSignIn(
  _previous: SignInState,
  form: FormData,
): Promise<SignInState> {
  const requestHeaders = await headers();
  const ip = clientIp(requestHeaders);

  if (!(await takeRateLimit("signIn", ip))) {
    return {
      error: "Too many sign-in attempts. Wait a few minutes and try again.",
    };
  }
  if (!(await verifyTurnstile(form.get("cf-turnstile-response"), ip))) {
    return {
      error: "We couldn't confirm you're human. Tick the check and try again.",
    };
  }

  const returnTo = safeReturnPath(form.get("next"));
  const origin = appOrigin(
    requestHeaders,
    publicEnv().NEXT_PUBLIC_SITE_URL,
    isProduction,
  );
  const callback = new URL("/auth/callback", origin);
  callback.searchParams.set("next", returnTo);

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: callback.toString() },
  });
  if (error || !data.url) {
    return {
      error: "Google sign-in is unavailable right now. Try again shortly.",
    };
  }

  redirect(data.url);
}

export async function signOut(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/");
}
