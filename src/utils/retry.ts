/**
 * Generic retry/backoff and concurrency-limiting helpers. Used by
 * KindleReaderClient (Phase 3) to keep Amazon request volume low:
 * bounded retries on transient errors only, no retry on rate limiting.
 */

export interface RetryOptions {
  /** Maximum number of attempts, including the first one. */
  maxAttempts: number;
  /** Base delay in milliseconds before the first retry. */
  baseDelayMs: number;
  /** Predicate deciding whether a given error is worth retrying. */
  isRetryable: (error: unknown) => boolean;
  /** Injectable for tests; defaults to a real timer-based sleep. */
  sleep?: (ms: number) => Promise<void>;
}

const defaultSleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Runs `fn`, retrying with exponential backoff while `isRetryable`
 * returns true, up to `maxAttempts` total attempts. Rethrows the last
 * error once attempts are exhausted or the error is not retryable.
 */
export async function retryAsync<T>(fn: () => Promise<T>, options: RetryOptions): Promise<T> {
  const sleep = options.sleep ?? defaultSleep;
  let attempt = 0;
  let lastError: unknown;

  while (attempt < options.maxAttempts) {
    attempt += 1;
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const hasAttemptsLeft = attempt < options.maxAttempts;
      if (!hasAttemptsLeft || !options.isRetryable(error)) {
        throw error;
      }
      const delay = options.baseDelayMs * 2 ** (attempt - 1);
      await sleep(delay);
    }
  }

  throw lastError;
}

/**
 * Runs `tasks` with at most `limit` concurrently in flight. Used to cap
 * per-book fetch concurrency at 1-2 per the request-control requirement.
 */
export async function runWithConcurrencyLimit<T>(
  tasks: Array<() => Promise<T>>,
  limit: number,
): Promise<T[]> {
  const results: T[] = new Array<T>(tasks.length);
  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (nextIndex < tasks.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      const task = tasks[currentIndex];
      if (!task) {
        continue;
      }
      results[currentIndex] = await task();
    }
  }

  const workerCount = Math.max(1, Math.min(limit, tasks.length));
  await Promise.all(Array.from({ length: workerCount }, () => worker()));

  return results;
}
