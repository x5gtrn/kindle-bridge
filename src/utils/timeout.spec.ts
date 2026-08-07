import { describe, expect, it, vi } from "vitest";
import { TimeoutError, withTimeout } from "./timeout";

describe("withTimeout", () => {
  it("resolves with the inner value when it settles before the timeout", async () => {
    await expect(withTimeout(Promise.resolve("value"), 1000, "too slow")).resolves.toBe("value");
  });

  it("rejects with the inner error when it rejects before the timeout", async () => {
    await expect(withTimeout(Promise.reject(new Error("boom")), 1000, "too slow")).rejects.toThrow(
      "boom",
    );
  });

  it("rejects with TimeoutError once the timeout elapses first", async () => {
    vi.useFakeTimers();
    try {
      const neverSettles = new Promise(() => undefined);
      const result = withTimeout(neverSettles, 1000, "took too long");
      const assertion = expect(result).rejects.toThrow(TimeoutError);
      await vi.advanceTimersByTimeAsync(1000);
      await assertion;
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not fire the timeout after the promise already resolved", async () => {
    vi.useFakeTimers();
    try {
      const result = await withTimeout(Promise.resolve("fast"), 1000, "too slow");
      expect(result).toBe("fast");
      // If the timer weren't cleared, advancing past it would surface an
      // unhandled rejection from the abandoned timeout branch.
      await vi.advanceTimersByTimeAsync(2000);
    } finally {
      vi.useRealTimers();
    }
  });
});
