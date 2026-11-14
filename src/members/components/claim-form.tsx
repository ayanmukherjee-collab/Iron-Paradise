"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { redeemClaimLink, type ClaimState } from "@/members/claim-actions";

export function ClaimForm({ token }: { token: string }) {
  const [state, submit, pending] = useActionState<ClaimState, FormData>(
    redeemClaimLink,
    { error: null },
  );

  return (
    <form
      action={submit}
      className="mt-8 flex w-full max-w-sm flex-col items-center gap-4"
    >
      <input type="hidden" name="token" value={token} />
      <Button
        type="submit"
        variant="light"
        disabled={pending}
        className="w-full"
      >
        {pending ? "Connecting…" : "Yes, connect it"}
      </Button>
      {state.error && (
        <p role="alert" className="border-l-4 border-white pl-3 text-left">
          {state.error}
        </p>
      )}
    </form>
  );
}
