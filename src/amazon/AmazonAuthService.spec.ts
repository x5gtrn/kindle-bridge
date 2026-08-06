import { describe, expect, it } from "vitest";
import { getAmazonRegion } from "./AmazonRegion";
import { AmazonAuthUnsupportedError, ElectronAmazonAuthService } from "./AmazonAuthService";
import { Logger } from "../utils/logger";

describe("ElectronAmazonAuthService", () => {
  it("throws AmazonAuthUnsupportedError instead of crashing when Electron's remote bridge is unavailable", async () => {
    const service = new ElectronAmazonAuthService(new Logger({ level: "error" }));
    const region = getAmazonRegion("jp");
    expect(() => service.signIn(region)).toThrow(AmazonAuthUnsupportedError);
    await expect(service.signOut(region)).rejects.toThrow(AmazonAuthUnsupportedError);
  });
});
