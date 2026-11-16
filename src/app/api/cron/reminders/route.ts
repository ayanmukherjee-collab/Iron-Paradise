import { getDb } from "@/db/client";
import { reminderEnv } from "@/lib/env";
import { configuredChannels } from "@/notifications/channels";
import { hasCronSecret } from "@/notifications/cron-auth";
import { runReminders } from "@/notifications/job";

// Called by the Worker's own Cron Trigger (worker.ts), never by a browser.
// No session exists here, so the shared secret is the only way in.
export async function POST(request: Request) {
  const { CRON_SECRET } = reminderEnv();
  if (!CRON_SECRET) {
    return reply(
      { error: "Reminders are not set up: CRON_SECRET is missing" },
      503,
    );
  }
  if (!hasCronSecret(request.headers.get("authorization"), CRON_SECRET)) {
    return reply({ error: "Not allowed" }, 401);
  }

  const result = await runReminders(getDb(), configuredChannels());
  console.log("Reminder run", JSON.stringify(result));
  return reply(result, 200);
}

function reply(body: object, status: number) {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}
