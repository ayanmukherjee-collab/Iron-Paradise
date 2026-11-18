// The yearly close (supabase/migrations/*_year_close.sql), called by pg_cron
// at 06:00 India time on 1–7 April. The first run closes the year; the
// others find it closed and stop. Before deleting anything it saves the old
// payments and check-ins as CSV in the private "archives" storage bucket;
// if that upload fails, nothing is deleted.
import { todayAtGym } from "@/lib/dates";
import { hasCronSecret } from "@/notifications/cron-auth";
import { runYearClose, type YearCloseFiles } from "@/payments/year-close-run";
import { connect, json, secret, serve } from "./env";

async function saveToStorage({ folder, files }: YearCloseFiles) {
  const url = secret("SUPABASE_URL");
  const key = secret("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("Storage isn't reachable: no service key");
  for (const file of files) {
    const response = await fetch(
      `${url}/storage/v1/object/archives/${folder}/${file.name}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          apikey: key,
          "Content-Type": "text/csv; charset=utf-8",
          "x-upsert": "true",
        },
        body: file.csv,
      },
    );
    if (!response.ok) {
      throw new Error(
        `Saving ${folder}/${file.name} failed: ${response.status} ${await response.text()}`,
      );
    }
  }
}

serve(async (request) => {
  if (request.method !== "POST") return json({ error: "POST only" }, 405);
  const cronSecret = secret("CRON_SECRET");
  if (!cronSecret) {
    return json({ error: "Not set up: CRON_SECRET is missing" }, 503);
  }
  if (!hasCronSecret(request.headers.get("authorization"), cronSecret)) {
    return json({ error: "Not allowed" }, 401);
  }

  const { db, close } = connect();
  try {
    const result = await runYearClose(db, todayAtGym(), saveToStorage);
    console.log("Year close", JSON.stringify(result));
    return json(result);
  } catch (error) {
    console.error("Year close failed", error);
    return json(
      { error: error instanceof Error ? error.message : String(error) },
      500,
    );
  } finally {
    await close();
  }
});
