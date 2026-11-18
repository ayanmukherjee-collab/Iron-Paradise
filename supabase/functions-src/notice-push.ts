// Called by the app right after an owner or manager posts a notice
// (saveAnnouncement in web/src/actions/bulletin.ts). Sends the heading and a
// short line of the notice to every member who turned notifications on in
// the app. Signing a push needs the private VAPID key, so it runs here.
import { and, eq, exists, inArray, ne } from "drizzle-orm";
import {
  announcements,
  members,
  profiles,
  pushSubscriptions,
} from "@/db/schema";
import { deliverPush } from "@/notifications/channels/push";
import { noticePush } from "@/notifications/notice-push";
import { cors, userId } from "./caller";
import { connect, json, serve, vapidKeys } from "./env";

/** A notice is sent once, by whoever posted it, soon after posting. */
const sendWithinMs = 15 * 60_000;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Notices this instance already sent, so a double tap doesn't send twice.
const sent = new Set<string>();

serve(async (request) => {
  const headers = cors(request);
  if (request.method === "OPTIONS")
    return new Response(null, { status: 204, headers });
  if (request.method !== "POST")
    return json({ ok: false, message: "POST only" }, 405, headers);

  const reply = (ok: boolean, message: string, delivered = 0) =>
    json({ ok, message, delivered }, 200, headers);
  const keys = vapidKeys();
  if (!keys)
    return reply(false, "Push notifications aren't set up on the server.");

  const id = await userId(request);
  if (!id) return reply(false, "Your session ended. Sign in again.");

  const body = (await request.json().catch(() => null)) as {
    announcementId?: unknown;
  } | null;
  const announcementId = body?.announcementId;
  if (typeof announcementId !== "string" || !uuid.test(announcementId)) {
    return reply(false, "Which notice?");
  }
  if (sent.has(announcementId)) return reply(true, "Already sent.");

  const { db, close } = connect();
  try {
    const [caller] = await db
      .select({ role: profiles.role, isActive: profiles.isActive })
      .from(profiles)
      .where(eq(profiles.id, id));
    if (
      !caller?.isActive ||
      (caller.role !== "owner" && caller.role !== "manager")
    ) {
      return reply(false, "Only the owner and managers can send notices.");
    }

    const [notice] = await db
      .select({
        id: announcements.id,
        title: announcements.title,
        body: announcements.body,
        createdBy: announcements.createdBy,
        createdAt: announcements.createdAt,
      })
      .from(announcements)
      .where(eq(announcements.id, announcementId));
    if (
      !notice ||
      notice.createdBy !== id ||
      Date.now() - notice.createdAt.getTime() > sendWithinMs
    ) {
      return reply(false, "Only a notice you just posted can be sent.");
    }
    sent.add(notice.id);

    // Phones of active members with an active account, other than the
    // poster's own.
    const targets = await db
      .select({
        endpoint: pushSubscriptions.endpoint,
        p256dh: pushSubscriptions.p256dh,
        auth: pushSubscriptions.auth,
      })
      .from(pushSubscriptions)
      .innerJoin(profiles, eq(profiles.id, pushSubscriptions.profileId))
      .where(
        and(
          eq(profiles.isActive, true),
          ne(pushSubscriptions.profileId, id),
          exists(
            db
              .select({ one: members.id })
              .from(members)
              .where(
                and(
                  eq(members.profileId, pushSubscriptions.profileId),
                  eq(members.isActive, true),
                ),
              ),
          ),
        ),
      );
    if (targets.length === 0) {
      return reply(true, "No member has notifications on yet.");
    }

    const delivery = await deliverPush(targets, noticePush(notice), keys);
    if (delivery.expiredEndpoints?.length) {
      await db
        .delete(pushSubscriptions)
        .where(inArray(pushSubscriptions.endpoint, delivery.expiredEndpoints));
    }
    if (!delivery.ok) {
      sent.delete(notice.id);
      return reply(false, "The push service didn't accept it.");
    }
    return reply(
      true,
      delivery.delivered === 1
        ? "Sent to 1 phone."
        : `Sent to ${delivery.delivered} phones.`,
      delivery.delivered,
    );
  } finally {
    await close();
  }
});
