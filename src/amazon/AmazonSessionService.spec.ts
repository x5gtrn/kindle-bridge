import { beforeEach, describe, expect, it, vi } from "vitest";
import { AmazonAuthUnsupportedError } from "./AmazonAuthTypes";
import { getAmazonRegion } from "./AmazonRegion";
import { CdpAmazonSessionService } from "./AmazonSessionService";
import { BrowserNotFoundError } from "./cdp/browserExecutable";
import { CdpBrowser, type CdpPage } from "./cdp/CdpBrowser";

vi.mock("./cdp/CdpBrowser", () => ({
  CdpBrowser: { launch: vi.fn() },
}));

beforeEach(() => {
  vi.mocked(CdpBrowser.launch).mockReset();
});

function fakePage(finalUrl: string): CdpPage {
  return {
    navigate: vi.fn().mockResolvedValue(undefined),
    getCurrentUrl: vi.fn().mockResolvedValue(finalUrl),
    getHtml: vi.fn().mockResolvedValue(""),
    onFrameNavigated: vi.fn(),
    onDocumentResponse: vi.fn(),
    waitForLoad: vi.fn().mockResolvedValue(undefined),
  };
}

function fakeBrowser(page: CdpPage) {
  return {
    newPage: vi.fn().mockResolvedValue(page),
    close: vi.fn(),
    onExit: vi.fn(),
    clearCookies: vi.fn(),
  };
}

const region = getAmazonRegion("jp");

describe("CdpAmazonSessionService", () => {
  it("throws AmazonAuthUnsupportedError instead of crashing when no browser is found", async () => {
    vi.mocked(CdpBrowser.launch).mockRejectedValueOnce(new BrowserNotFoundError());
    const service = new CdpAmazonSessionService(() => "/tmp/kindle-bridge-test-profile");
    await expect(service.isSessionValid(region)).rejects.toThrow(AmazonAuthUnsupportedError);
  });

  it("returns true when the final URL lands on the reader, not the sign-in page", async () => {
    const browser = fakeBrowser(fakePage("https://read.amazon.co.jp/notebook"));
    vi.mocked(CdpBrowser.launch).mockResolvedValueOnce(browser as unknown as CdpBrowser);

    const service = new CdpAmazonSessionService(() => "/tmp/kindle-bridge-test-profile");
    await expect(service.isSessionValid(region)).resolves.toBe(true);
    expect(browser.close).toHaveBeenCalled();
  });

  it("returns false when the final URL is Amazon's sign-in page", async () => {
    const browser = fakeBrowser(
      fakePage("https://www.amazon.co.jp/ap/signin?openid.assoc_handle=jpflex"),
    );
    vi.mocked(CdpBrowser.launch).mockResolvedValueOnce(browser as unknown as CdpBrowser);

    const service = new CdpAmazonSessionService(() => "/tmp/kindle-bridge-test-profile");
    await expect(service.isSessionValid(region)).resolves.toBe(false);
  });

  it("returns false when the final URL isn't under the region's reader URL at all", async () => {
    const browser = fakeBrowser(fakePage("https://www.amazon.co.jp/some/other/page"));
    vi.mocked(CdpBrowser.launch).mockResolvedValueOnce(browser as unknown as CdpBrowser);

    const service = new CdpAmazonSessionService(() => "/tmp/kindle-bridge-test-profile");
    await expect(service.isSessionValid(region)).resolves.toBe(false);
  });

  it("returns false (rather than throwing) if the browser interaction itself fails", async () => {
    const page = fakePage("https://read.amazon.co.jp/notebook");
    vi.mocked(page.navigate).mockRejectedValueOnce(new Error("boom"));
    const browser = fakeBrowser(page);
    vi.mocked(CdpBrowser.launch).mockResolvedValueOnce(browser as unknown as CdpBrowser);

    const service = new CdpAmazonSessionService(() => "/tmp/kindle-bridge-test-profile");
    await expect(service.isSessionValid(region)).resolves.toBe(false);
    expect(browser.close).toHaveBeenCalled();
  });
});
