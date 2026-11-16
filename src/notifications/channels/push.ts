import "server-only";
import {
  describeFailure,
  type Channel,
  type Delivery,
  type Fetch,
} from "@/notifications/channels/types";
import {
  buildPushRequest,
  type PushTarget,
  type VapidKeys,
} from "@/notifications/web-push";

// A reminder that arrives a day late is still useful; one that arrives two
// days late is not.
const ttlSeconds = 24 * 60 * 60;

/** What the service worker (src/pwa/sw.ts) shows. */
export interface PushMessage {
  title: string;
  body: string;
  url: string;
  /** A newer message with the same tag replaces the older one on screen. */
  tag: string;
}

/**
 * Sends one message to each browser. Succeeds if at least one browser got
 * it, and reports browsers the push service says are gone so they can be
 * forgotten.
 */
export async function deliverPush(
  targets: PushTarget[],
  message: PushMessage,
  keys: VapidKeys,
  fetchFn: Fetch = fetch,
): Promise<Delivery & { delivered: number }> {
  const payload = JSON.stringify(message);
  const results = await Promise.all(
    targets.map(async (target) => {
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

  const delivered = results.filter((result) => result.ok).length;
  const expiredEndpoints = results
    .filter((result) => "gone" in result && result.gone)
    .map((result) => result.endpoint);
  if (delivered > 0) return { ok: true, delivered, expiredEndpoints };
  return {
    ok: false,
    delivered,
    error: results.find((result) => result.error)?.error ?? "Push failed",
    expiredEndpoints,
  };
}

/** Push notifications to every browser the member turned them on in. */
export function createPushChannel(
  keys: VapidKeys,
  fetchFn: Fetch = fetch,
): Channel {
  return {
    name: "push",
    reaches: (recipient) => recipient.pushTargets.length > 0,
    cost: (recipient) => recipient.pushTargets.length,
    send: (recipient, { message, reminder }) =>
      deliverPush(
        recipient.pushTargets,
        {
          title: message.title,
          body: message.body,
          url: "/app",
          tag: `fee-${reminder.period}`,
        },
        keys,
        fetchFn,
      ),
  };
}
