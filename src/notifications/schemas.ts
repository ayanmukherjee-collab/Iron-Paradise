// Zod schemas for reminder inputs, kept apart from actions.ts because a
// "use server" file may export only actions.
import { z } from "zod";
import { isPushServiceEndpoint } from "@/notifications/web-push";

export const pushEndpoint = z
  .string()
  .max(1000)
  .refine(isPushServiceEndpoint, "This browser's push service isn't supported");

/** A browser's push subscription, as `PushSubscription.toJSON()` gives it. */
export const pushSubscription = z.object({
  endpoint: pushEndpoint,
  p256dh: z.string().regex(/^[A-Za-z0-9_-]{86,88}$/, "Invalid browser key"),
  auth: z.string().regex(/^[A-Za-z0-9_-]{22,24}$/, "Invalid browser key"),
});
