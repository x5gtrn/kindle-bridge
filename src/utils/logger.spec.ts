import { describe, expect, it, vi } from "vitest";
import { Logger } from "./logger";

describe("Logger", () => {
  it("masks context keys that look sensitive", () => {
    const sink = vi.fn();
    const logger = new Logger({ level: "debug", sink });

    logger.debug("session check", {
      cookie: "abc123",
      sessionToken: "def456",
      password: "hunter2",
      otp: "000000",
      authHeader: "Bearer xyz",
      region: "jp",
    });

    const [, message] = sink.mock.calls[0] as [string, string];
    expect(message).not.toContain("abc123");
    expect(message).not.toContain("def456");
    expect(message).not.toContain("hunter2");
    expect(message).not.toContain("000000");
    expect(message).not.toContain("Bearer xyz");
    expect(message).toContain("jp");
  });

  it("does not emit messages below the configured level", () => {
    const sink = vi.fn();
    const logger = new Logger({ level: "warn", sink });

    logger.debug("hidden");
    logger.info("also hidden");
    logger.warn("visible");

    expect(sink).toHaveBeenCalledTimes(1);
    expect(sink.mock.calls[0]?.[1]).toContain("visible");
  });

  it("masks sensitive keys nested inside arrays and objects", () => {
    const sink = vi.fn();
    const logger = new Logger({ level: "debug", sink });

    logger.debug("nested", {
      requests: [{ cookie: "secret-cookie" }],
    });

    const [, message] = sink.mock.calls[0] as [string, string];
    expect(message).not.toContain("secret-cookie");
  });
});
