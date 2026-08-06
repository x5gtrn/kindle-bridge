import type { Logger } from "../utils/logger";
import { retryAsync } from "../utils/retry";
import { AmazonAuthUnsupportedError } from "./AmazonAuthService";
import { AmazonSessionExpiredError } from "./AmazonSessionService";
import type { AmazonRegion } from "./AmazonRegion";
import { SESSION_PARTITION, getElectronRemote, keepNavigationEmbedded } from "./electronRemote";

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

export class ElectronKindleReaderClient implements KindleReaderClient {
  private lastRequestAt = 0;

  constructor(private readonly logger: Logger) {}

  fetchBookListHtml(region: AmazonRegion): Promise<string> {
    return this.fetchRenderedHtml(region.notebookUrl, region);
  }

  fetchBookAnnotationsHtml(region: AmazonRegion, asin: string): Promise<string> {
    // MVP fetches only the first page of annotations for a book; Amazon
    // paginates heavily-annotated books beyond a per-page limit, which
    // this client does not yet follow - see docs/risks.md.
    const url = `${region.notebookUrl}?asin=${encodeURIComponent(asin)}&contentLimitState=`;
    return this.fetchRenderedHtml(url, region);
  }

  private async fetchRenderedHtml(url: string, region: AmazonRegion): Promise<string> {
    await this.waitForRequestSlot();
    return retryAsync(() => this.loadAndExtractHtml(url, region), {
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

  private async loadAndExtractHtml(url: string, region: AmazonRegion): Promise<string> {
    const remote = getElectronRemote();
    if (!remote) {
      throw new AmazonAuthUnsupportedError();
    }

    const win = new remote.BrowserWindow({
      show: false,
      webPreferences: { partition: SESSION_PARTITION },
    });
    keepNavigationEmbedded(win);

    let httpResponseCode: number | undefined;
    win.webContents.on("did-navigate", (_event, _url, responseCode) => {
      if (typeof responseCode === "number") {
        httpResponseCode = responseCode;
      }
    });

    try {
      await win.loadURL(url);

      if (httpResponseCode === RATE_LIMIT_HTTP_STATUS) {
        throw new HttpTooManyRequestsError();
      }

      const finalUrl = win.webContents.getURL();
      if (finalUrl.includes(SIGN_IN_URL_MARKER) || !finalUrl.startsWith(region.kindleReaderUrl)) {
        throw new AmazonSessionExpiredError();
      }

      return await win.webContents.executeJavaScript<string>("document.documentElement.outerHTML");
    } catch (error) {
      if (error instanceof HttpTooManyRequestsError || error instanceof AmazonSessionExpiredError) {
        throw error;
      }
      const message = error instanceof Error ? error.message : "unknown network error";
      this.logger.warn("Transient error fetching an Amazon page", { message });
      throw new TransientNetworkError(message);
    } finally {
      if (!win.isDestroyed()) {
        win.close();
      }
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
