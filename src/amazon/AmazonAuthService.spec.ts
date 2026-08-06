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

  it("cancelPendingSignIn() is a safe no-op when no sign-in is in progress", () => {
    // This is the common case: onunload() calls this unconditionally.
    // Real cancellation of an in-flight sign-in (closing the BrowserWindow
    // and clearing its timeout) is verified by code review only - fully
    // faking Electron's BrowserWindow/webContents event API was judged
    // disproportionate effort for this fix; see
    // docs/mvp-acceptance-report.md.
    const service = new ElectronAmazonAuthService(new Logger({ level: "error" }));
    expect(() => service.cancelPendingSignIn()).not.toThrow();
  });
});
