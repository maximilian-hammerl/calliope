import { setTimeout as delay } from "node:timers/promises";

/** Rejects once `milliseconds` pass, and clears its timer either way so nothing outlives the call. */
export async function withDeadline<T>(promise: Promise<T>, milliseconds: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;

  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`No answer within ${milliseconds} ms`)),
          milliseconds,
        );
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

export type RetryOptions = {
  minTimeout: number;
  maxTimeout: number;
  maxAttempts: number;
};

/** Calls `attempt` until it resolves, doubling the pause between calls up to `maxTimeout`. */
export function retry<T>(attempt: () => Promise<T>, options: RetryOptions): Promise<T> {
  const tryFrom = async (attemptNumber: number): Promise<T> => {
    try {
      return await attempt();
    } catch (error) {
      if (attemptNumber >= options.maxAttempts) {
        throw error;
      }

      await delay(Math.min(options.minTimeout * 2 ** (attemptNumber - 1), options.maxTimeout));
      return tryFrom(attemptNumber + 1);
    }
  };

  return tryFrom(1);
}
