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

const devHost =
  /^(localhost|127\.0\.0\.1|10(\.\d{1,3}){3}|192\.168(\.\d{1,3}){2}|172\.(1[6-9]|2\d|3[01])(\.\d{1,3}){2})(:\d{1,5})?$/;

/**
 * The origin to send people back to after Google sign-in.
 *
 * Production always uses the configured site URL, so a forged Host header
 * cannot redirect anyone elsewhere. In development the request's own host is
 * used when it is localhost or a private LAN address, so a phone testing via
 * http://10.x.x.x:3000 comes back to that address instead of "localhost",
 * which on a phone means the phone itself.
 */
export function appOrigin(
  headers: Headers,
  siteUrl: string,
  isProduction: boolean,
): string {
  const configured = new URL(siteUrl).origin;
  if (isProduction) return configured;
  const host = headers.get("host") ?? "";
  return devHost.test(host) ? `http://${host}` : configured;
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
