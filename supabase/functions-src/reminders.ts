// The daily reminder run (brief §4.6), moved from the Worker's Cron Trigger
// (src/app/api/cron/reminders) to a Supabase Edge Function, called on a
// schedule by pg_cron (docs/static-rebuild.md, "Reminders"). The job itself
// is unchanged: src/notifications/job.ts, which never sends twice.
import { hasCronSecret } from "@/notifications/cron-auth";
import { runReminders } from "@/notifications/job";
import { configuredChannels, connect, json, secret, serve } from "./env";

serve(async (request) => {
  if (request.method !== "POST") return json({ error: "POST only" }, 405);
  const cronSecret = secret("CRON_SECRET");
  if (!cronSecret) {
    return json(
      { error: "Reminders are not set up: CRON_SECRET is missing" },
      503,
    );
  }
  // No session here: the shared secret is the only way in.
  if (!hasCronSecret(request.headers.get("authorization"), cronSecret)) {
    return json({ error: "Not allowed" }, 401);
  }

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
});
