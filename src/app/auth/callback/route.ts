import { NextResponse, type NextRequest } from "next/server";
import { publicEnv } from "@/lib/env";
import { safeReturnPath } from "@/lib/request";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// Google sends the person back here with a one-time code, which is swapped
// for a session cookie (PKCE: the verifier was stored when sign-in started).
export async function GET(request: NextRequest) {
  const site = publicEnv().NEXT_PUBLIC_SITE_URL;
  const code = request.nextUrl.searchParams.get("code");
  const returnTo = safeReturnPath(request.nextUrl.searchParams.get("next"));

  if (code) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(returnTo, site));
  }

  return NextResponse.redirect(new URL("/sign-in?error=callback", site));
}
