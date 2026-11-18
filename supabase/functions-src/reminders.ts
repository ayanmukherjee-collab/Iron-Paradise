// The daily reminder run (brief §4.6), moved from the Worker's Cron Trigger
// (src/app/api/cron/reminders) to a Supabase Edge Function, called on a
// schedule by pg_cron (docs/static-rebuild.md, "Reminders"). The job itself
// is unchanged: src/notifications/job.ts, which never sends twice.
//
// The bell on the Reminders screen calls it too, as a signed-in owner or
// manager: that run sends push and email to everyone the screen lists as
// due ("staff" mode), not only the daily windows.
import { eq } from "drizzle-orm";
import { profiles } from "@/db/schema";
import { hasCronSecret } from "@/notifications/cron-auth";
import { runReminders } from "@/notifications/job";
import { cors, userId } from "./caller";
import { configuredChannels, connect, json, secret, serve } from "./env";

serve(async (request) => {
  const headers = cors(request);
  if (request.method === "OPTIONS")
    return new Response(null, { status: 204, headers });
  if (request.method !== "POST")
    return json({ error: "POST only" }, 405, headers);

  const cronSecret = secret("CRON_SECRET");
  const authorization = request.headers.get("authorization");
  if (cronSecret && hasCronSecret(authorization, cronSecret)) {
    const { db, close } = connect();
    try {
      // Edge Functions have no per-run request cap like the Worker's free
      // plan, so one run can send far more; later runs still pick up the rest.
      const result = await runReminders(db, configuredChannels(), {
        budget: 400,
      });
      console.log("Reminder run", JSON.stringify(result));
      return json(result);
    } finally {
      await close();
    }
  }

  // Otherwise it must be staff pressing the bell.
  const reply = (ok: boolean, message: string) =>
    json({ ok, message }, 200, headers);
  const channels = configuredChannels();
  if (channels.length === 0) {
    return reply(false, "Push and email aren't set up on the server.");
  }
  const id = await userId(request);
  if (!id) return reply(false, "Your session ended. Sign in again.");

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
      return reply(false, "Only the owner and managers can send reminders.");
    }
    const result = await runReminders(db, channels, {
      budget: 400,
      mode: "staff",
      sentBy: id,
    });
    console.log("Reminder bell", JSON.stringify(result));
    return reply(true, bellMessage(result));
  } finally {
    await close();
  }
});

function bellMessage(result: {
  due: number;
  sent: number;
  failed: number;
  alreadySent: number;
  deferred: number;
}): string {
  if (result.due === 0) {
    return "No one to remind on push or email. Members need the app or an email on their account.";
  }
  const parts = [
    `Sent ${result.sent}`,
    result.alreadySent > 0 && `${result.alreadySent} already sent`,
    result.failed > 0 && `${result.failed} failed`,
    result.deferred > 0 && `${result.deferred} left for later`,
  ].filter(Boolean);
  return `${parts.join(" · ")}.`;
}
