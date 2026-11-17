// Browser version of src/members/claim-actions.ts. Outside guardedAction on
// purpose: the person claiming is a guest, with no permissions until this
// succeeds. public.redeem_claim_token decides whether the token is valid,
// unused and unexpired, and is the only way an account gets linked.
import { supabase } from "../lib/supabase";
import { currentViewer } from "../auth/viewer";
import { failureFor, Refusal } from "../data/action";

export interface ClaimState {
  error: string | null;
}

export async function redeemClaimLink(
  _previous: ClaimState,
  form: FormData,
): Promise<ClaimState> {
  if (!currentViewer())
    return { error: "Sign in with Google first, then open the link again." };

  const token = form.get("token");
  if (typeof token !== "string" || !/^[A-Za-z0-9_-]{32,128}$/.test(token)) {
    return { error: "This link has expired or was already used" };
  }

  const { error } = await supabase.rpc("redeem_claim_token", {
    raw_token: token,
  });
  if (error) {
    const failure = failureFor(error);
    return {
      error:
        failure instanceof Refusal
          ? failure.message
          : "Couldn't reach the gym's database. Check your connection and try again.",
    };
  }
  // A full load: the person is now a member, with a different app around them.
  window.location.assign("/app");
  return { error: null };
}
