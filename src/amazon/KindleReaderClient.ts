import type { Logger } from "../utils/logger";
import { retryAsync } from "../utils/retry";
import { withTimeout } from "../utils/timeout";
import { AmazonAuthUnsupportedError } from "./AmazonAuthTypes";
import { AmazonSessionExpiredError } from "./AmazonSessionService";
import type { AmazonRegion } from "./AmazonRegion";
import { BrowserNotFoundError } from "./cdp/browserExecutable";
import { CdpBrowser } from "./cdp/CdpBrowser";
import { ANNOTATION_SELECTOR } from "./KindleAnnotationParser";
import { safeUrlOrigin } from "./urlSafety";

/**
 * Fetches rendered HTML from Amazon's notebook page. The only module
 * allowed to make network requests to Amazon. Enforces request
 * discipline (single in-flight request with a minimum interval between
 * requests, bounded retries on transient errors, hard stop on HTTP 429)
 * - see docs/architecture.md §5. Cross-book concurrency (capped at 1-2)
 * is the caller's (KindleSyncService's) responsibility.
 */
export interface KindleReaderClient {
  fetchBookListHtml(region: AmazonRegion): Promise<string>;
  fetchBookAnnotationsHtml(region: AmazonRegion, asin: string): Promise<string>;
}

export class HttpTooManyRequestsError extends Error {
  constructor() {
    super("Amazon returned HTTP 429 (rate limited); stopping sync.");
    this.name = "HttpTooManyRequestsError";
  }
}

/** Network/navigation error that's worth a bounded retry (timeouts,
 * connection resets) - as opposed to HttpTooManyRequestsError or
 * AmazonSessionExpiredError, which must never be retried. */
export class TransientNetworkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TransientNetworkError";
  }
}

const REQUEST_INTERVAL_MS = 1500;
const MAX_ATTEMPTS = 3;
const BASE_RETRY_DELAY_MS = 1000;
const SIGN_IN_URL_MARKER = "/ap/signin";
const RATE_LIMIT_HTTP_STATUS = 429;
const PAGE_LOAD_TIMEOUT_MS = 30 * 1000;
const ANNOTATIONS_RENDER_TIMEOUT_MS = 8 * 1000;

export class CdpKindleReaderClient implements KindleReaderClient {
  private lastRequestAt = 0;

  constructor(
    private readonly getProfileDir: () => string,
    private readonly logger: Logger,
  ) {}

  fetchBookListHtml(region: AmazonRegion): Promise<string> {
    return this.fetchRenderedHtml(region.notebookUrl, region);
  }

  fetchBookAnnotationsHtml(region: AmazonRegion, asin: string): Promise<string> {
    // MVP fetches only the first page of annotations for a book; Amazon
    // paginates heavily-annotated books beyond a per-page limit, which
    // this client does not yet follow - see docs/risks.md.
    const url = `${region.notebookUrl}?asin=${encodeURIComponent(asin)}&contentLimitState=`;
    // Unlike the book list, a book's highlights/notes are fetched and
    // rendered by the page's own JavaScript *after* the `load` event
    // (selecting a book via `?asin=` doesn't itself block page load) -
    // see the CdpPage.waitForSelector doc comment. Waiting for the first
    // annotation to actually appear avoids snapshotting an empty
    // container and treating every book as having zero highlights.
    return this.fetchRenderedHtml(url, region, ANNOTATION_SELECTOR);
  }

  private async fetchRenderedHtml(
    url: string,
    region: AmazonRegion,
    waitForSelector?: string,
  ): Promise<string> {
    await this.waitForRequestSlot();
    return retryAsync(() => this.loadAndExtractHtml(url, region, waitForSelector), {
      maxAttempts: MAX_ATTEMPTS,
      baseDelayMs: BASE_RETRY_DELAY_MS,
      isRetryable: (error) => error instanceof TransientNetworkError,
    });
  }

  private async waitForRequestSlot(): Promise<void> {
    const elapsed = Date.now() - this.lastRequestAt;
    if (elapsed < REQUEST_INTERVAL_MS) {
      await sleep(REQUEST_INTERVAL_MS - elapsed);
    }
    this.lastRequestAt = Date.now();
  }

  private async loadAndExtractHtml(
    url: string,
    region: AmazonRegion,
    waitForSelector?: string,
  ): Promise<string> {
    this.logger.debug("Fetching Amazon page", { origin: safeUrlOrigin(url) });
    let browser: CdpBrowser;
    try {
      browser = await CdpBrowser.launch({ userDataDir: this.getProfileDir(), headless: true });
    } catch (error) {
      if (error instanceof BrowserNotFoundError) {
        throw new AmazonAuthUnsupportedError();
      }
      throw error;
    }

    try {
      const page = await browser.newPage();

      let httpStatus: number | undefined;
      page.onDocumentResponse((status) => {
        httpStatus = status;
      });

      const loaded = page.waitForLoad();
      await page.navigate(url);
      await withTimeout(
        loaded,
        PAGE_LOAD_TIMEOUT_MS,
        "Timed out waiting for the Amazon page to finish loading.",
      );

      if (httpStatus === RATE_LIMIT_HTTP_STATUS) {
        throw new HttpTooManyRequestsError();
      }

      const finalUrl = await page.getCurrentUrl();
      if (finalUrl.includes(SIGN_IN_URL_MARKER) || !finalUrl.startsWith(region.kindleReaderUrl)) {
        throw new AmazonSessionExpiredError();
      }

      if (waitForSelector) {
        const rendered = await page.waitForSelector(waitForSelector, ANNOTATIONS_RENDER_TIMEOUT_MS);
        this.logger.debug(
          rendered
            ? "Annotations rendered"
            : "No annotations rendered within timeout (book may genuinely have none)",
          { origin: safeUrlOrigin(finalUrl) },
        );
      }

      const html = await page.getHtml();
      this.logger.debug("Fetched Amazon page", {
        origin: safeUrlOrigin(finalUrl),
        bytes: html.length,
      });
      return html;
    } catch (error) {
      if (error instanceof HttpTooManyRequestsError || error instanceof AmazonSessionExpiredError) {
        throw error;
      }
      const message = error instanceof Error ? error.message : "unknown network error";
      this.logger.warn("Transient error fetching an Amazon page", { message });
      throw new TransientNetworkError(message);
    } finally {
      browser.close();
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}
