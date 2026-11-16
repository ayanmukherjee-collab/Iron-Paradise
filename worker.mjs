// The Worker's entry point. OpenNext builds the app into .open-next/worker.js,
// which only answers web requests; this file adds the daily Cron Trigger
// (wrangler.jsonc → triggers.crons) and hands everything else to OpenNext.
//
// Plain JavaScript on purpose: .open-next/ only exists after a Cloudflare
// build, so a TypeScript import of it could not type-check in CI.
import openNext from "./.open-next/worker.js";

const worker = {
  fetch: openNext.fetch,

  /**
   * Runs the reminder job by calling the app's own cron route in-process,
   * so the job uses the same code, database client and logging as every
   * other request. The route checks CRON_SECRET; the cron is safe to fire
   * several times a day because the job never sends a reminder twice.
   */
  async scheduled(controller, env, ctx) {
    if (!env.CRON_SECRET) {
      console.warn("Reminders are off: set the CRON_SECRET Worker secret.");
      return;
    }
    const request = new Request("https://cron.internal/api/cron/reminders", {
      method: "POST",
      headers: { authorization: `Bearer ${env.CRON_SECRET}` },
    });
    const response = await openNext.fetch(request, env, ctx);
    const body = await response.text();
    if (!response.ok) {
      // Shows the run as failed in the Worker's Cron Events and logs.
      throw new Error(`Reminder run failed (${response.status}): ${body}`);
    }
  },
};

export default worker;
