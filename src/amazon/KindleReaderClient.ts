import { NotImplementedYetError } from "../utils/errors";
import type { AmazonRegion } from "./AmazonRegion";

/**
 * Fetches rendered HTML from Amazon's notebook page. The only module
 * allowed to make network requests to Amazon. Enforces request
 * discipline (low concurrency, inter-request delay, bounded retries on
 * transient errors, hard stop on HTTP 429) - see docs/architecture.md §5.
 * Implemented in Phase 3.
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

export class ElectronKindleReaderClient implements KindleReaderClient {
  fetchBookListHtml(_region: AmazonRegion): Promise<string> {
    throw new NotImplementedYetError("Kindle book list retrieval", "Phase 3");
  }

  fetchBookAnnotationsHtml(_region: AmazonRegion, _asin: string): Promise<string> {
    throw new NotImplementedYetError("Kindle annotation retrieval", "Phase 3");
  }
}
