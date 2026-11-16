import { describe, expect, it, vi } from "vitest";
import { createRequestBuffer } from "./request-buffer";

const ok = () => new Response("ok", { status: 200 });
const busy = () => new Response("busy", { status: 503 });

/** A request the test finishes by hand. */
function pending() {
  let finish!: (response: Response) => void;
  const promise = new Promise<Response>((resolve) => (finish = resolve));
  return { promise, finish };
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

function buffer(overrides: Partial<Parameters<typeof createRequestBuffer>[0]>) {
  return createRequestBuffer({
    maxInFlight: 2,
    retryDelaysMs: [1000, 3000],
    sleep: () => Promise.resolve(),
    random: () => 0.5,
    ...overrides,
  });
}

describe("request buffer", () => {
  it("sends no more than maxInFlight at once and lets the rest wait", async () => {
    const b = buffer({});
    const requests = [pending(), pending(), pending()];
    const started: number[] = [];
    const results = requests.map((request, index) =>
      b.send(() => {
        started.push(index);
        return request.promise;
      }),
    );
    await flush();
    expect(started).toEqual([0, 1]);
    expect(b.stats()).toEqual({ active: 2, waiting: 1 });

    requests[0].finish(ok());
    await flush();
    expect(started).toEqual([0, 1, 2]);

    requests[1].finish(ok());
    requests[2].finish(ok());
    await Promise.all(results);
    expect(b.stats()).toEqual({ active: 0, waiting: 0 });
  });

  it("lets page loads go ahead of prefetches that were queued earlier", async () => {
    const b = buffer({ maxInFlight: 1 });
    const first = pending();
    const order: string[] = [];
    const record = (name: string) => () => {
      order.push(name);
      return Promise.resolve(ok());
    };
    const done = [
      b.send(() => first.promise),
      b.send(record("prefetch"), { background: true }),
      b.send(record("page"), {}),
    ];
    await flush();
    first.finish(ok());
    await Promise.all(done);
    expect(order).toEqual(["page", "prefetch"]);
  });

  it("retries a 503 with growing, jittered waits, then returns the answer", async () => {
    const sleep = vi.fn(() => Promise.resolve());
    const b = buffer({ sleep, random: () => 0 });
    const answers = [busy(), busy(), ok()];
    const attempts: number[] = [];
    const response = await b.send(
      async (attempt) => {
        attempts.push(attempt);
        return answers[attempt];
      },
      { retry: true },
    );
    expect(response.status).toBe(200);
    expect(attempts).toEqual([0, 1, 2]);
    // random() = 0 gives the shortest wait: 70% of the plan.
    expect(sleep.mock.calls).toEqual([[700], [2100]]);
  });

  it("gives up after the last retry and hands back the 503", async () => {
    const b = buffer({});
    let calls = 0;
    const response = await b.send(
      async () => {
        calls++;
        return busy();
      },
      { retry: true },
    );
    expect(response.status).toBe(503);
    expect(calls).toBe(3);
  });

  it("never repeats a request that isn't marked safe to retry", async () => {
    const b = buffer({});
    let calls = 0;
    const response = await b.send(async () => {
      calls++;
      return busy();
    });
    expect(response.status).toBe(503);
    expect(calls).toBe(1);
  });

  it("does not retry other errors", async () => {
    const b = buffer({});
    let calls = 0;
    const response = await b.send(
      async () => {
        calls++;
        return new Response("", { status: 500 });
      },
      { retry: true },
    );
    expect(response.status).toBe(500);
    expect(calls).toBe(1);
  });

  it("frees the place when a request fails outright", async () => {
    const b = buffer({ maxInFlight: 1 });
    await expect(
      b.send(() => Promise.reject(new TypeError("offline"))),
    ).rejects.toThrow("offline");
    expect(b.stats()).toEqual({ active: 0, waiting: 0 });
    expect((await b.send(async () => ok())).status).toBe(200);
  });

  it("frees the place of a request that hangs, so the queue keeps moving", async () => {
    vi.useFakeTimers();
    try {
      const b = buffer({ maxInFlight: 1, slotTimeoutMs: 5000 });
      void b.send(() => new Promise<Response>(() => {}));
      const second = b.send(async () => ok());
      await vi.advanceTimersByTimeAsync(4999);
      expect(b.stats()).toEqual({ active: 1, waiting: 1 });
      await vi.advanceTimersByTimeAsync(1);
      expect((await second).status).toBe(200);
    } finally {
      vi.useRealTimers();
    }
  });
});
