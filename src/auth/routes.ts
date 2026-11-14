// Every route needs a signed-in user unless it is listed here. New pages are
// private by default, so forgetting to list one fails safe.

const publicExact = new Set([
  "/",
  "/sign-in",
  "/auth/callback",
  "/~offline",
  "/manifest.webmanifest",
  "/robots.txt",
  "/sitemap.xml",
  "/favicon.ico",
  "/sw.js",
]);

// Claim pages are public so a signed-out member can see what to do next.
const publicPrefixes = ["/_next/", "/brand/", "/art/", "/icons/", "/claim/"];

export function isPublicPath(pathname: string): boolean {
  return (
    publicExact.has(pathname) ||
    publicPrefixes.some((prefix) => pathname.startsWith(prefix))
  );
}

export function isApiPath(pathname: string): boolean {
  return pathname === "/api" || pathname.startsWith("/api/");
}
