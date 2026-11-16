// Every route needs a signed-in user unless it is listed here. New pages are
// private by default, so forgetting to list one fails safe.

const publicExact = new Set([
  "/",
  "/sign-in",
  "/privacy",
  "/terms",
  "/auth/callback",
  "/~offline",
  "/manifest.webmanifest",
  "/robots.txt",
  "/sitemap.xml",
  "/favicon.ico",
  "/sw.js",
  // Has no session: checks the cron secret itself (see the route).
  "/api/cron/reminders",
]);

// Claim pages are public so a signed-out member can see what to do next.
// Desk pages are public because the desk device holds no account; each one
// checks its own secret link instead.
const publicPrefixes = [
  "/_next/",
  "/brand/",
  "/art/",
  "/icons/",
  "/claim/",
  "/desk/",
];

export function isPublicPath(pathname: string): boolean {
  return (
    publicExact.has(pathname) ||
    publicPrefixes.some((prefix) => pathname.startsWith(prefix))
  );
}

export function isApiPath(pathname: string): boolean {
  return pathname === "/api" || pathname.startsWith("/api/");
}
