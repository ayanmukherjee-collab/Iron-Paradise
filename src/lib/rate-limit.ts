import "server-only";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { isProduction, serverEnv } from "@/lib/env";

// Sliding windows per client IP. Limits are generous for a gym front desk
// where several people share one Wi-Fi address.
const limits = {
  signIn: { requests: 20, window: "10 m" },
  claimLink: { requests: 10, window: "1 h" },
  slipScan: { requests: 60, window: "1 h" },
  // Per member: a few scans a day at most, so this only stops guessing.
  checkIn: { requests: 30, window: "1 h" },
  // Per IP: a desk display asks for a new code about every 30 seconds.
  deskDisplay: { requests: 600, window: "1 h" },
  // Per account: test notifications go out through the browser push services.
  testPush: { requests: 5, window: "10 m" },
} as const satisfies Record<
  string,
  { requests: number; window: `${number} ${"s" | "m" | "h"}` }
>;

export type RateLimitName = keyof typeof limits;

let limiters: Map<RateLimitName, Ratelimit> | null = null;
let warnedMissingRedis = false;

function getLimiters(): Map<RateLimitName, Ratelimit> | null {
  if (limiters) return limiters;

  const { UPSTASH_REDIS_REST_URL: url, UPSTASH_REDIS_REST_TOKEN: token } =
    serverEnv();
  if (!url || !token) {
    // A production deploy without rate limiting is a security bug, so fail
    // loudly. Local development may run without an Upstash account.
    if (isProduction)
      throw new Error(
        "UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are required in production",
      );
    if (!warnedMissingRedis) {
      console.warn(
        "Rate limiting is off: Upstash Redis is not configured (development only).",
      );
      warnedMissingRedis = true;
    }
    return null;
  }

  const redis = new Redis({ url, token });
  limiters = new Map(
    (
      Object.entries(limits) as [
        RateLimitName,
        (typeof limits)[RateLimitName],
      ][]
    ).map(([name, limit]) => [
      name,
      new Ratelimit({
        redis,
        prefix: `ratelimit:${name}`,
        limiter: Ratelimit.slidingWindow(limit.requests, limit.window),
      }),
    ]),
  );
  return limiters;
}

/** Returns true when the request may go ahead. */
export async function takeRateLimit(
  name: RateLimitName,
  key: string,
): Promise<boolean> {
  const limiter = getLimiters()?.get(name);
  if (!limiter) return true;
  const { success } = await limiter.limit(key);
  return success;
}
