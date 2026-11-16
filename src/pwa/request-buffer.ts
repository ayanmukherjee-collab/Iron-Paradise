// A small queue that sits in the service worker between the app and the
// server. The Worker runs on Cloudflare's free plan, which cuts requests off
// with a 503 when too many arrive close together and run past its CPU limit.
// So each device:
//
// - sends at most `maxInFlight` page loads at once; the rest wait their turn
//   on the device, with prefetches (guesses about the next page) going last;
// - waits and tries again when the server answers 503, a little later each
//   time and with some randomness, so phones that failed together don't all
//   come back at the same instant.
//
// Only requests that are safe to send twice should be retried (page loads,
// not saves). The caller decides that per request.

export interface RequestBufferOptions {
  /** How many requests may be waiting on the server at once. */
  maxInFlight: number;
  /** Wait before each retry of a 503; its length is the number of retries. */
  retryDelaysMs: readonly number[];
  /**
   * A request that hangs gives its place back after this long (it carries
   * on), so one stuck request can't block the device's queue.
   */
  slotTimeoutMs?: number;
  sleep?: (ms: number) => Promise<void>;
  random?: () => number;
}

export interface SendOptions {
  /** Waits behind everything else (prefetches). */
  background?: boolean;
  /** Try again after a 503. Only for requests that are safe to repeat. */
  retry?: boolean;
}

/** Sends one attempt; `attempt` is 0 for the first try, 1 for the first retry. */
export type Attempt = (attempt: number) => Promise<Response>;

const defaultSleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

export function createRequestBuffer({
  maxInFlight,
  retryDelaysMs,
  slotTimeoutMs = 10_000,
  sleep = defaultSleep,
  random = Math.random,
}: RequestBufferOptions) {
  let active = 0;
  const urgent: (() => void)[] = [];
  const background: (() => void)[] = [];

  function next() {
    const start = urgent.shift() ?? background.shift();
    if (start) {
      active++;
      start();
    }
  }

  /** Waits for a place; resolves to the function that gives it back. */
  function acquire(low: boolean): Promise<() => void> {
    const slot = () => {
      let held = true;
      const giveBack = () => {
        if (!held) return;
        held = false;
        clearTimeout(timer);
        active--;
        next();
      };
      const timer = setTimeout(giveBack, slotTimeoutMs);
      return giveBack;
    };
    if (active < maxInFlight) {
      active++;
      return Promise.resolve(slot());
    }
    return new Promise((resolve) =>
      (low ? background : urgent).push(() => resolve(slot())),
    );
  }

  async function send(
    attempt: Attempt,
    options: SendOptions = {},
  ): Promise<Response> {
    for (let tried = 0; ; tried++) {
      // The first try queues by its own priority; a retry goes to the front,
      // since someone has already been waiting for it.
      const giveBack = await acquire(tried === 0 && !!options.background);
      let response: Response;
      try {
        response = await attempt(tried);
      } finally {
        giveBack();
      }
      if (
        response.status !== 503 ||
        !options.retry ||
        tried >= retryDelaysMs.length
      ) {
        return response;
      }
      // Free the failed response; the next try gets a fresh one.
      response.body?.cancel().catch(() => {});
      // 70%–130% of the planned wait.
      await sleep(retryDelaysMs[tried] * (0.7 + random() * 0.6));
    }
  }

  return {
    send,
    /** For tests: requests on the server right now, and waiting. */
    stats: () => ({
      active,
      waiting: urgent.length + background.length,
    }),
  };
}
