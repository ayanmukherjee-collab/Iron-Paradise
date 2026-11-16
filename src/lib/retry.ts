/**
 * Calls `run` again when it throws, waiting `delaysMs[i]` before retry i+1.
 * A thrown error from a Server Action call means the request never got a
 * proper answer (for example Cloudflare cut it off with a 503), not that the
 * server refused. Refusals come back as values and are returned as they are.
 *
 * Only for actions that are safe to run twice, like a check-in, which the
 * database ignores if the member is already in today.
 */
export async function retryOnThrow<T>(
  run: () => Promise<T>,
  delaysMs: readonly number[],
  sleep: (ms: number) => Promise<void> = (ms) =>
    new Promise((resolve) => setTimeout(resolve, ms)),
): Promise<T> {
  for (let tried = 0; ; tried++) {
    try {
      return await run();
    } catch (error) {
      if (tried >= delaysMs.length) throw error;
      await sleep(delaysMs[tried]);
    }
  }
}
