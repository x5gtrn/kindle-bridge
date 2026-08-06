import { describe, expect, it } from "vitest";
import { AmazonAuthUnsupportedError } from "./AmazonAuthService";
import { getAmazonRegion } from "./AmazonRegion";
import { ElectronAmazonSessionService } from "./AmazonSessionService";

describe("ElectronAmazonSessionService", () => {
  it("throws AmazonAuthUnsupportedError instead of crashing when Electron's remote bridge is unavailable", async () => {
    const service = new ElectronAmazonSessionService();
    await expect(service.isSessionValid(getAmazonRegion("jp"))).rejects.toThrow(
      AmazonAuthUnsupportedError,
    );
  });
});
