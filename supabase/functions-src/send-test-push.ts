// "Send a test" on the push toggle (sendTestNotification in
// web/src/actions/notifications.ts). Signing a push needs the private VAPID
// key, which must never reach a phone, so this runs here.
import { eq, inArray } from "drizzle-orm";
import { pushSubscriptions } from "@/db/schema";
import { deliverPush } from "@/notifications/channels/push";
import { cors, userId } from "./caller";
import { connect, json, serve, vapidKeys } from "./env";

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
        body: "Notifications work on this phone. Notices and fee reminders will look like this.",
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
