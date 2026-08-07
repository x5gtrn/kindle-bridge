import { beforeEach, describe, expect, it, vi } from "vitest";
import { getAmazonRegion } from "./AmazonRegion";
import { AmazonAuthUnsupportedError, CdpAmazonAuthService } from "./AmazonAuthService";
import { BrowserNotFoundError } from "./cdp/browserExecutable";
import { CdpBrowser } from "./cdp/CdpBrowser";
import { Logger } from "../utils/logger";

// CdpAmazonAuthService launches a real, separate browser process via
// CdpBrowser.launch() - mocked here so tests never spawn a real
// process (which would happen if Chrome/Edge is actually installed on
// the machine running the tests, unlike Electron's `remote`, which
// simply doesn't resolve under Vitest and gave us that for free).
vi.mock("./cdp/CdpBrowser", () => ({
  CdpBrowser: { launch: vi.fn() },
}));

beforeEach(() => {
  vi.mocked(CdpBrowser.launch).mockReset();
});

function buildService(): CdpAmazonAuthService {
  return new CdpAmazonAuthService(() => "/tmp/kindle-bridge-test-profile", new Logger({ level: "error" }));
}

describe("CdpAmazonAuthService", () => {
  it("throws AmazonAuthUnsupportedError instead of crashing when no browser is found (signIn)", async () => {
    vi.mocked(CdpBrowser.launch).mockRejectedValueOnce(new BrowserNotFoundError());
    await expect(buildService().signIn(getAmazonRegion("jp"))).rejects.toThrow(
      AmazonAuthUnsupportedError,
    );
  });

  it("throws AmazonAuthUnsupportedError instead of crashing when no browser is found (signOut)", async () => {
    vi.mocked(CdpBrowser.launch).mockRejectedValueOnce(new BrowserNotFoundError());
    await expect(buildService().signOut(getAmazonRegion("jp"))).rejects.toThrow(
      AmazonAuthUnsupportedError,
    );
  });

  it("propagates a non-BrowserNotFoundError launch failure as-is", async () => {
    vi.mocked(CdpBrowser.launch).mockRejectedValueOnce(new Error("spawn EACCES"));
    await expect(buildService().signIn(getAmazonRegion("jp"))).rejects.toThrow("spawn EACCES");
  });

  it("cancelPendingSignIn() is a safe no-op when no sign-in is in progress", () => {
    expect(() => buildService().cancelPendingSignIn()).not.toThrow();
  });
});
