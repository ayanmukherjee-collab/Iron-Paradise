import type { CookieOptionsWithName } from "@supabase/ssr";

/**
 * Session cookies are HttpOnly: only the server ever talks to Supabase Auth
 * (there is no browser Supabase client), so page scripts never need them, and
 * an injected script cannot read or steal a session. Secure whenever the site
 * is served over HTTPS (always, once deployed); left off on plain-http local
 * runs so a phone on http://10.x.x.x can still sign in.
 */
export const sessionCookieOptions: CookieOptionsWithName = {
  httpOnly: true,
  sameSite: "lax",
  secure: (process.env.NEXT_PUBLIC_SITE_URL ?? "").startsWith("https://"),
  path: "/",
};
