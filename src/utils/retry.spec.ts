import { describe, expect, it, vi } from "vitest";
import { retryAsync, runWithConcurrencyLimit } from "./retry";

describe("retryAsync", () => {
  it("returns the result on first success without retrying", async () => {
    const fn = vi.fn().mockResolvedValue("ok");
    const result = await retryAsync(fn, {
      maxAttempts: 3,
      baseDelayMs: 0,
      isRetryable: () => true,
      sleep: vi.fn().mockResolvedValue(undefined),
    });
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retries retryable errors up to maxAttempts", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("transient"))
      .mockRejectedValueOnce(new Error("transient"))
      .mockResolvedValue("ok");
    const sleep = vi.fn().mockResolvedValue(undefined);

    const result = await retryAsync(fn, {
      maxAttempts: 3,
      baseDelayMs: 10,
      isRetryable: () => true,
      sleep,
    });

    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenCalledTimes(2);
  });

  it("does not retry when isRetryable returns false", async () => {
    const error = new Error("rate limited");
    const fn = vi.fn().mockRejectedValue(error);

    await expect(
      retryAsync(fn, {
        maxAttempts: 5,
        baseDelayMs: 0,
        isRetryable: () => false,
        sleep: vi.fn().mockResolvedValue(undefined),
      }),
    ).rejects.toThrow("rate limited");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("gives up after maxAttempts and rethrows the last error", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("still failing"));

    await expect(
      retryAsync(fn, {
        maxAttempts: 3,
        baseDelayMs: 0,
        isRetryable: () => true,
        sleep: vi.fn().mockResolvedValue(undefined),
      }),
    ).rejects.toThrow("still failing");
    expect(fn).toHaveBeenCalledTimes(3);
  });
});

describe("runWithConcurrencyLimit", () => {
  it("runs all tasks and preserves result order", async () => {
    const tasks = [1, 2, 3, 4, 5].map((n) => () => Promise.resolve(n * 10));
    const results = await runWithConcurrencyLimit(tasks, 2);
    expect(results).toEqual([10, 20, 30, 40, 50]);
  });

  it("never exceeds the concurrency limit", async () => {
    let inFlight = 0;
    let maxInFlight = 0;

    const tasks = Array.from({ length: 6 }, () => async () => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((resolve) => window.setTimeout(resolve, 5));
      inFlight -= 1;
      return true;
    });

    await runWithConcurrencyLimit(tasks, 2);
    expect(maxInFlight).toBeLessThanOrEqual(2);
  });
});
