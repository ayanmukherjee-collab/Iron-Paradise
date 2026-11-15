import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { publicEnv } from "@/lib/env";
import { sessionCookieOptions } from "@/lib/supabase/cookie-options";

/**
 * Refreshes the Supabase session cookie before the page renders, and returns
 * the verified user id. `requestHeaders` carries extra headers (the CSP
 * nonce) that must survive when the response is rebuilt with new cookies.
 */
export async function refreshSession(
  request: NextRequest,
  requestHeaders: Headers,
) {
  const env = publicEnv();
  const forward = () =>
    NextResponse.next({ request: { headers: requestHeaders } });
  let response = forward();

  const supabase = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookieOptions: sessionCookieOptions,
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, cacheHeaders) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          requestHeaders.set("cookie", request.headers.get("cookie") ?? "");
          response = forward();
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
          for (const [key, value] of Object.entries(cacheHeaders)) {
            response.headers.set(key, value);
          }
        },
      },
    },
  );

  // getClaims verifies the JWT signature; getSession would trust the cookie.
  const { data } = await supabase.auth.getClaims();
  const userId = typeof data?.claims?.sub === "string" ? data.claims.sub : null;

  return { response, userId };
}
