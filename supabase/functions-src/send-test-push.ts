// "Send a test" on the push toggle (sendTestNotification in
// web/src/actions/notifications.ts). Signing a push needs the private VAPID
// key, which must never reach a phone, so this runs here.
import { eq, inArray } from "drizzle-orm";
import { pushSubscriptions } from "@/db/schema";
import { deliverPush } from "@/notifications/channels/push";
import { connect, json, secret, serve, siteUrl, vapidKeys } from "./env";

/** Only the app's own pages may call this from a browser. */
function cors(request: Request): Record<string, string> {
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
async function userId(request: Request): Promise<string | null> {
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

// One test a minute per person is plenty; kept in this instance's memory
// (the old app used Upstash), which is enough to stop a stuck button.
const lastTest = new Map<string, number>();

serve(async (request) => {
  const headers = cors(request);
  if (request.method === "OPTIONS")
    return new Response(null, { status: 204, headers });
  if (request.method !== "POST")
    return json({ ok: false, message: "POST only" }, 405, headers);

  const reply = (ok: boolean, message: string) =>
    json({ ok, message }, 200, headers);
  const keys = vapidKeys();
  if (!keys)
    return reply(false, "Push notifications aren't set up on the server.");

  const id = await userId(request);
  if (!id) return reply(false, "Your session ended. Sign in again.");
  const now = Date.now();
  if (now - (lastTest.get(id) ?? 0) < 60_000) {
    return reply(false, "That's a lot of tests. Try again in a minute.");
  }
  lastTest.set(id, now);

  const { db, close } = connect();
  try {
    // The filter is the user id Supabase Auth just confirmed, never one
    // taken from the request body.
    const targets = await db
      .select({
        endpoint: pushSubscriptions.endpoint,
        p256dh: pushSubscriptions.p256dh,
        auth: pushSubscriptions.auth,
      })
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.profileId, id));
    if (targets.length === 0) {
      return reply(false, "Turn on notifications on this phone first.");
    }
    const delivery = await deliverPush(
      targets,
      {
        title: "Test notification",
        body: "Notifications work on this phone. Fee reminders will look like this.",
        url: "/app",
        tag: "test",
      },
      keys,
    );
    if (delivery.expiredEndpoints?.length) {
      await db
        .delete(pushSubscriptions)
        .where(inArray(pushSubscriptions.endpoint, delivery.expiredEndpoints));
    }
    if (!delivery.ok) {
      return reply(
        false,
        "The push service didn't accept it. Turn notifications off and on again, then retry.",
      );
    }
    return reply(
      true,
      delivery.delivered === 1
        ? "Sent. It should pop up in a few seconds."
        : `Sent to ${delivery.delivered} devices. It should pop up in a few seconds.`,
    );
  } finally {
    await close();
  }
});
