"use server";

import { sql } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { databaseErrorMessage } from "@/auth/guarded-action";
import { getViewer } from "@/auth/session";
import { getDb } from "@/db/client";
import { withUserContext } from "@/db/user-context";
import { takeRateLimit } from "@/lib/rate-limit";
import { clientIp } from "@/lib/request";

export interface ClaimState {
  error: string | null;
}

// Deliberately outside guardedAction: the person claiming is a guest, who
// holds no permissions until this succeeds. The session check, rate limit and
// format check happen here; the SQL function decides whether the token is
// valid, unused and unexpired.
export async function redeemClaimLink(
  _previous: ClaimState,
  form: FormData,
): Promise<ClaimState> {
  const viewer = await getViewer();
  if (!viewer)
    return { error: "Sign in with Google first, then open the link again." };

  const ip = clientIp(await headers());
  if (!(await takeRateLimit("claimLink", `${ip}:${viewer.userId}`))) {
    return {
      error: "Too many tries. Wait a while, then ask the gym for a fresh link.",
    };
  }

  const token = form.get("token");
  if (typeof token !== "string" || !/^[A-Za-z0-9_-]{32,128}$/.test(token)) {
    return { error: "This link has expired or was already used" };
  }

  try {
    await withUserContext(getDb(), viewer.userId, (tx) =>
      tx.execute(sql`select public.redeem_claim_token(${token})`),
    );
  } catch (error) {
    const message = databaseErrorMessage(error);
    if (message) return { error: message };
    throw error;
  }

  redirect("/app");
}
