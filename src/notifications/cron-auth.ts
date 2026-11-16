import { createHash, timingSafeEqual } from "node:crypto";

/**
 * Whether a request carries the cron secret as a bearer token. Both sides are
 * hashed first so the comparison takes the same time whatever was sent, and
 * a missing secret on the server refuses everything.
 */
export function hasCronSecret(
  authorization: string | null,
  secret: string | undefined,
): boolean {
  if (!secret || !authorization?.startsWith("Bearer ")) return false;
  const digest = (value: string) => createHash("sha256").update(value).digest();
  return timingSafeEqual(
    digest(authorization.slice("Bearer ".length)),
    digest(secret),
  );
}
