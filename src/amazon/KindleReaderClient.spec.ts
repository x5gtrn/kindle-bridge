import { beforeEach, describe, expect, it, vi } from "vitest";
import { AmazonAuthUnsupportedError } from "./AmazonAuthTypes";
import { getAmazonRegion } from "./AmazonRegion";
import { AmazonSessionExpiredError } from "./AmazonSessionService";
import { BrowserNotFoundError } from "./cdp/browserExecutable";
import { CdpBrowser, type CdpPage } from "./cdp/CdpBrowser";
import { ANNOTATION_SELECTOR } from "./KindleAnnotationParser";
import { CdpKindleReaderClient, HttpTooManyRequestsError, TransientNetworkError } from "./KindleReaderClient";
import { Logger } from "../utils/logger";

vi.mock("./cdp/CdpBrowser", () => ({
  CdpBrowser: { launch: vi.fn() },
}));

beforeEach(() => {
  vi.mocked(CdpBrowser.launch).mockReset();
});

function fakePage(overrides: Partial<CdpPage> = {}): CdpPage {
  return {
    navigate: vi.fn().mockResolvedValue(undefined),
    getCurrentUrl: vi.fn().mockResolvedValue("https://read.amazon.co.jp/notebook"),
    getHtml: vi.fn().mockResolvedValue("<html></html>"),
    onFrameNavigated: vi.fn(),
    onDocumentResponse: vi.fn(),
    waitForLoad: vi.fn().mockResolvedValue(undefined),
    waitForSelector: vi.fn().mockResolvedValue(true),
    ...overrides,
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

function buildClient(): CdpKindleReaderClient {
  return new CdpKindleReaderClient(
    () => "/tmp/kindle-bridge-test-profile",
    new Logger({ level: "error" }),
  );
}

const region = getAmazonRegion("jp");

describe("CdpKindleReaderClient", () => {
  it("throws AmazonAuthUnsupportedError instead of crashing when no browser is found", async () => {
    vi.mocked(CdpBrowser.launch).mockRejectedValueOnce(new BrowserNotFoundError());
    await expect(buildClient().fetchBookListHtml(region)).rejects.toThrow(
      AmazonAuthUnsupportedError,
    );
  });

  it("returns the page HTML on a normal, authenticated fetch", async () => {
    const browser = fakeBrowser(fakePage());
    vi.mocked(CdpBrowser.launch).mockResolvedValueOnce(browser as unknown as CdpBrowser);

    await expect(buildClient().fetchBookListHtml(region)).resolves.toBe("<html></html>");
    expect(browser.close).toHaveBeenCalled();
  });

  it("throws AmazonSessionExpiredError when the final URL is Amazon's sign-in page", async () => {
    const page = fakePage({
      getCurrentUrl: vi.fn().mockResolvedValue("https://www.amazon.co.jp/ap/signin"),
    });
    const browser = fakeBrowser(page);
    vi.mocked(CdpBrowser.launch).mockResolvedValueOnce(browser as unknown as CdpBrowser);

    await expect(buildClient().fetchBookListHtml(region)).rejects.toThrow(
      AmazonSessionExpiredError,
    );
  });

  it("throws HttpTooManyRequestsError on a 429 document response and does not retry", async () => {
    const page = fakePage({
      onDocumentResponse: vi.fn((listener: (status: number, url: string) => void) => {
        listener(429, region.notebookUrl);
      }),
    });
    const browser = fakeBrowser(page);
    vi.mocked(CdpBrowser.launch).mockResolvedValue(browser as unknown as CdpBrowser);

    await expect(buildClient().fetchBookListHtml(region)).rejects.toThrow(
      HttpTooManyRequestsError,
    );
    // One attempt only - 429 must never be retried.
    expect(CdpBrowser.launch).toHaveBeenCalledTimes(1);
  });

  it("wraps an unexpected failure in TransientNetworkError and retries up to the bound", async () => {
    const page = fakePage({ navigate: vi.fn().mockRejectedValue(new Error("ERR_TIMED_OUT")) });
    const browser = fakeBrowser(page);
    vi.mocked(CdpBrowser.launch).mockResolvedValue(browser as unknown as CdpBrowser);

    await expect(buildClient().fetchBookListHtml(region)).rejects.toThrow(TransientNetworkError);
    // MAX_ATTEMPTS = 3, one browser launch per attempt.
    expect(CdpBrowser.launch).toHaveBeenCalledTimes(3);
  }, 10000);

  it("waits for an annotation to render before reading HTML when fetching a book's annotations", async () => {
    const page = fakePage();
    const browser = fakeBrowser(page);
    vi.mocked(CdpBrowser.launch).mockResolvedValueOnce(browser as unknown as CdpBrowser);

    await buildClient().fetchBookAnnotationsHtml(region, "B000TEST01");

    expect(page.waitForSelector).toHaveBeenCalledWith(ANNOTATION_SELECTOR, expect.any(Number));
  });

  it("does not wait for the annotation selector when fetching only the book list", async () => {
    const page = fakePage();
    const browser = fakeBrowser(page);
    vi.mocked(CdpBrowser.launch).mockResolvedValueOnce(browser as unknown as CdpBrowser);

    await buildClient().fetchBookListHtml(region);

    expect(page.waitForSelector).not.toHaveBeenCalled();
  });

  it("times out (rather than hanging forever) when the page never fires a load event, retrying up to the bound", async () => {
    vi.useFakeTimers();
    try {
      // Simulates Page.loadEventFired never arriving - waitForLoad()'s
      // real implementation would never resolve in that case either.
      const page = fakePage({ waitForLoad: vi.fn().mockReturnValue(new Promise(() => undefined)) });
      const browser = fakeBrowser(page);
      vi.mocked(CdpBrowser.launch).mockResolvedValue(browser as unknown as CdpBrowser);

      const result = buildClient().fetchBookListHtml(region);
      const assertion = expect(result).rejects.toThrow(TransientNetworkError);
      await vi.advanceTimersByTimeAsync(120_000);
      await assertion;
      // MAX_ATTEMPTS = 3, one browser launch per attempt.
      expect(CdpBrowser.launch).toHaveBeenCalledTimes(3);
    } finally {
      vi.useRealTimers();
    }
  }, 10000);
});
