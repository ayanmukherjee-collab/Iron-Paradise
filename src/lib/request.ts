/**
 * The caller's IP for rate limiting. Cloudflare sets cf-connecting-ip and
 * strips any value the client sent; x-forwarded-for is only a local fallback.
 */
export function clientIp(headers: Headers): string {
  return (
    headers.get("cf-connecting-ip") ??
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown"
  );
}

/**
 * Accepts only same-site relative paths for post-sign-in redirects, so a
 * crafted ?next= cannot bounce someone to another site.
 */
export function safeReturnPath(value: unknown, fallback = "/app"): string {
  if (typeof value !== "string") return fallback;
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\"))
    return fallback;
  return value;
}
