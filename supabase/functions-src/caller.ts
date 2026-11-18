// For Edge Functions the app's pages call directly: CORS for the app's own
// origins, and the caller's id as Supabase Auth confirms it.
import { secret, siteUrl } from "./env";

/** Only the app's own pages may call these from a browser. */
export function cors(request: Request): Record<string, string> {
  const origin = request.headers.get("origin");
  const allowed = [
    new URL(siteUrl()).origin,
    "http://localhost:5173",
    "http://localhost:4173",
  ];
  return origin && allowed.includes(origin)
    ? {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Headers":
          "authorization, apikey, content-type, x-client-info",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        Vary: "Origin",
      }
    : { Vary: "Origin" };
}

/** The signed-in user's id, checked by Supabase Auth itself. */
export async function userId(request: Request): Promise<string | null> {
  const authorization = request.headers.get("authorization");
  const url = secret("SUPABASE_URL");
  const key = secret("SUPABASE_ANON_KEY");
  if (!authorization || !url || !key) return null;
  const response = await fetch(`${url}/auth/v1/user`, {
    headers: { Authorization: authorization, apikey: key },
  });
  if (!response.ok) return null;
  const user = (await response.json()) as { id?: unknown };
  return typeof user.id === "string" ? user.id : null;
}
