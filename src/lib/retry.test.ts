import { describe, expect, it, vi } from "vitest";
import { retryOnThrow } from "./retry";

describe("retryOnThrow", () => {
  it("tries again after a throw and returns the first answer", async () => {
    const sleep = vi.fn(() => Promise.resolve());
    const run = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error("503"))
      .mockResolvedValueOnce("in");
    await expect(retryOnThrow(run, [1000, 3000], sleep)).resolves.toBe("in");
    expect(run).toHaveBeenCalledTimes(2);
    expect(sleep.mock.calls).toEqual([[1000]]);
  });

  it("returns a refusal as it is, without retrying", async () => {
    const run = vi.fn(async () => ({ ok: false, error: "No" }));
    await retryOnThrow(run, [1000], () => Promise.resolve());
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("throws the last error once the retries run out", async () => {
    const run = vi.fn(async () => {
      throw new Error("still down");
    });
    await expect(
      retryOnThrow(run, [1, 1], () => Promise.resolve()),
    ).rejects.toThrow("still down");
    expect(run).toHaveBeenCalledTimes(3);
  });
});
