// Shared by the Edge Functions (bundled by scripts/build-functions.mjs into
// supabase/functions/*/index.js). They run in Supabase's Deno runtime, which
// sets SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_DB_URL itself; the rest
// are secrets set with `npx supabase secrets set NAME=value`.
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@/db/schema";
import type { Database } from "@/db/user-context";
import { createEmailChannel } from "@/notifications/channels/email";
import { createPushChannel } from "@/notifications/channels/push";
import type { Channel } from "@/notifications/channels/types";
import type { VapidKeys } from "@/notifications/web-push";

declare const Deno: {
  env: { get(name: string): string | undefined };
  serve(handler: (request: Request) => Response | Promise<Response>): void;
};

export const serve = (handler: (request: Request) => Promise<Response>) =>
  Deno.serve(handler);

export function secret(name: string): string | undefined {
  return Deno.env.get(name) || undefined;
}

/** The site, for links in reminders and the push "subject". */
export function siteUrl(): string {
  return (
    secret("SITE_URL") ??
    "https://iron-paradise.ayanmukherjee-official01.workers.dev"
  );
}

export function vapidKeys(): VapidKeys | null {
  const publicKey = secret("VAPID_PUBLIC_KEY");
  const privateKey = secret("VAPID_PRIVATE_KEY");
  if (!publicKey || !privateKey) return null;
  return {
    publicKey,
    privateKey,
    subject: secret("VAPID_SUBJECT") ?? siteUrl(),
  };
}

/** Every automatic channel whose keys are set (as channels/index.ts did). */
export function configuredChannels(): Channel[] {
  const channels: Channel[] = [];
  const keys = vapidKeys();
  if (keys) channels.push(createPushChannel(keys));
  const apiKey = secret("RESEND_API_KEY");
  const from = secret("EMAIL_FROM");
  if (apiKey && from) {
    channels.push(
      createEmailChannel({ apiKey, from, appUrl: `${siteUrl()}/app` }),
    );
  }
  return channels;
}

/**
 * A database connection for one request, as the database owner (no RLS):
 * these functions act for the gym, not for a signed-in person, and filter by
 * the verified user id where it matters. Closed by the caller.
 */
export function connect(): { db: Database; close: () => Promise<void> } {
  const url = secret("SUPABASE_DB_URL");
  if (!url) throw new Error("SUPABASE_DB_URL is missing");
  const client = postgres(url, { prepare: false, max: 1, fetch_types: false });
  return {
    db: drizzle(client, { schema }) as unknown as Database,
    close: () => client.end({ timeout: 5 }),
  };
}

export function json(body: unknown, status = 200, headers: HeadersInit = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "private, no-store",
      ...headers,
    },
  });
}
