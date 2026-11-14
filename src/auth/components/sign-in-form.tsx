"use client";

import { useActionState } from "react";
import { Turnstile } from "@/auth/components/turnstile";
import { startGoogleSignIn, type SignInState } from "@/auth/sign-in-actions";
import { Button } from "@/components/ui/button";

type FormState = SignInState & { attempt: number };

const initialState: FormState = { error: null, attempt: 0 };

export function SignInForm({
  returnTo,
  turnstileSiteKey,
  nonce,
}: {
  returnTo: string;
  turnstileSiteKey: string;
  nonce?: string;
}) {
  const [state, submit, pending] = useActionState(
    async (previous: FormState, form: FormData): Promise<FormState> => ({
      ...(await startGoogleSignIn(previous, form)),
      attempt: previous.attempt + 1,
    }),
    initialState,
  );

  return (
    <form
      action={submit}
      className="mt-10 flex w-full max-w-sm flex-col items-center gap-5"
    >
      <input type="hidden" name="next" value={returnTo} />
      <Turnstile key={state.attempt} siteKey={turnstileSiteKey} nonce={nonce} />
      <Button
        type="submit"
        variant="light"
        disabled={pending}
        className="w-full"
      >
        <GoogleMark />
        {pending ? "Opening Google…" : "Continue with Google"}
      </Button>
      {state.error && (
        <p
          role="alert"
          className="border-l-4 border-white pl-3 text-left text-base text-white"
        >
          {state.error}
        </p>
      )}
    </form>
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
