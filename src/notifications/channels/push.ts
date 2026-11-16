import "server-only";
import {
  describeFailure,
  type Channel,
  type Delivery,
  type Fetch,
} from "@/notifications/channels/types";
import { buildPushRequest, type VapidKeys } from "@/notifications/web-push";

// A reminder that arrives a day late is still useful; one that arrives two
// days late is not.
const ttlSeconds = 24 * 60 * 60;

/** Push notifications to every browser the member turned them on in. */
export function createPushChannel(
  keys: VapidKeys,
  fetchFn: Fetch = fetch,
): Channel {
  return {
    name: "push",
    reaches: (recipient) => recipient.pushTargets.length > 0,
    cost: (recipient) => recipient.pushTargets.length,
    async send(recipient, { message, reminder }): Promise<Delivery> {
      const payload = JSON.stringify({
        title: message.title,
        body: message.body,
        url: "/app",
        // A newer reminder for the same fee replaces the older one on screen.
        tag: `fee-${reminder.period}`,
      });

      const results = await Promise.all(
        recipient.pushTargets.map(async (target) => {
          try {
            const { url, init } = await buildPushRequest(
              target,
              payload,
              keys,
              ttlSeconds,
            );
            const response = await fetchFn(url, init);
            if (response.ok) return { endpoint: target.endpoint, ok: true };
            return {
              endpoint: target.endpoint,
              ok: false,
              // 404 and 410 mean the browser unsubscribed or was reset.
              gone: response.status === 404 || response.status === 410,
              error: await describeFailure(response),
            };
          } catch (error) {
            return {
              endpoint: target.endpoint,
              ok: false,
              error: error instanceof Error ? error.message : "Push failed",
            };
          }
        }),
      );

      const expiredEndpoints = results
        .filter((result) => "gone" in result && result.gone)
        .map((result) => result.endpoint);
      if (results.some((result) => result.ok)) {
        return { ok: true, expiredEndpoints };
      }
      return {
        ok: false,
        error: results.find((result) => result.error)?.error ?? "Push failed",
        expiredEndpoints,
      };
    },
  };
}
