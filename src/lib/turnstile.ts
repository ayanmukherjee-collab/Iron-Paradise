import "server-only";
import { z } from "zod";
import { serverEnv } from "@/lib/env";

const verifyUrl = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

const responseSchema = z.object({ success: z.boolean() });

/** Checks a Cloudflare Turnstile token on the server. Any failure counts as "not human". */
export async function verifyTurnstile(
  token: unknown,
  remoteIp: string,
): Promise<boolean> {
  if (typeof token !== "string" || token.length === 0 || token.length > 2048)
    return false;

  const body = new URLSearchParams({
    secret: serverEnv().TURNSTILE_SECRET_KEY,
    response: token,
  });
  if (remoteIp !== "unknown") body.set("remoteip", remoteIp);

  try {
    const response = await fetch(verifyUrl, { method: "POST", body });
    if (!response.ok) return false;
    const parsed = responseSchema.safeParse(await response.json());
    return parsed.success && parsed.data.success;
  } catch {
    return false;
  }
}
