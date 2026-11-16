import "server-only";
import { publicEnv, reminderEnv } from "@/lib/env";
import { createEmailChannel } from "@/notifications/channels/email";
import { createPushChannel } from "@/notifications/channels/push";
import type { Channel } from "@/notifications/channels/types";
import type { VapidKeys } from "@/notifications/web-push";

/** The app's VAPID keys, or null while push is not set up. */
export function vapidKeys(): VapidKeys | null {
  const env = reminderEnv();
  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) return null;
  return {
    publicKey: env.VAPID_PUBLIC_KEY,
    privateKey: env.VAPID_PRIVATE_KEY,
    // Push services want a way to reach whoever runs the server.
    subject: env.VAPID_SUBJECT ?? publicEnv().NEXT_PUBLIC_SITE_URL,
  };
}

/** Every automated channel whose keys are set. */
export function configuredChannels(): Channel[] {
  const env = reminderEnv();
  const channels: Channel[] = [];

  const keys = vapidKeys();
  if (keys) channels.push(createPushChannel(keys));

  if (env.RESEND_API_KEY && env.EMAIL_FROM) {
    channels.push(
      createEmailChannel({
        apiKey: env.RESEND_API_KEY,
        from: env.EMAIL_FROM,
        appUrl: `${publicEnv().NEXT_PUBLIC_SITE_URL}/app`,
      }),
    );
  }
  return channels;
}
