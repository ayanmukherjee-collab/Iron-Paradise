import { NextResponse, type NextRequest } from "next/server";
import { isApiPath, isPublicPath } from "@/auth/routes";
import { publicEnv } from "@/lib/env";
import { buildCsp, createNonce } from "@/lib/security/csp";
import { refreshSession } from "@/lib/supabase/proxy";

// Runs before every page: sets a per-request CSP nonce, refreshes the
// Supabase session, and turns away signed-out requests to private routes.
// Pages and Server Actions still check the session themselves; this is the
// outer gate, not the only one.
export async function proxy(request: NextRequest) {
  const nonce = createNonce();
  const env = publicEnv();
  const csp = buildCsp({
    nonce,
    isDev: process.env.NODE_ENV === "development",
    supabaseUrl: env.NEXT_PUBLIC_SUPABASE_URL,
    siteUrl: env.NEXT_PUBLIC_SITE_URL,
  });

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const { response, userId } = await refreshSession(request, requestHeaders);
  const { pathname, search } = request.nextUrl;

  if (!userId && !isPublicPath(pathname)) {
    const denied = isApiPath(pathname)
      ? NextResponse.json({ error: "Sign in required" }, { status: 401 })
      : NextResponse.redirect(signInUrl(request, pathname + search));
    // Keep any cookie changes (for example a cleared, expired session).
    for (const cookie of response.cookies.getAll()) denied.cookies.set(cookie);
    denied.headers.set("Content-Security-Policy", csp);
    return denied;
  }

  response.headers.set("Content-Security-Policy", csp);
  return response;
}

function signInUrl(request: NextRequest, returnTo: string): URL {
  const url = new URL("/sign-in", request.url);
  url.searchParams.set("next", returnTo);
  return url;
}

export const config = {
  matcher: [
    {
      // Skip build assets and static files; they need neither a session nor a nonce.
      source:
        "/((?!_next/static|_next/image|sw\\.js|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp|avif|ico|webmanifest|txt|xml)$).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
