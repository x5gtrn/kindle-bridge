import type { Logger } from "../utils/logger";
import { withTimeout } from "../utils/timeout";
import { AmazonAuthUnsupportedError } from "./AmazonAuthTypes";
import type { AmazonRegion } from "./AmazonRegion";
import { BrowserNotFoundError } from "./cdp/browserExecutable";
import { CdpBrowser } from "./cdp/CdpBrowser";
import { safeUrlOrigin } from "./urlSafety";

const SIGN_IN_URL_MARKER = "/ap/signin";
const PAGE_LOAD_TIMEOUT_MS = 30 * 1000;

/** Thrown when Amazon redirects to its sign-in page instead of serving
 * the requested page - a continuation-breaking error that must stop the
 * whole sync (spec: "only stop the entire sync for continuation-breaking
 * errors, such as an expired session"), not just the single book being
 * fetched. */
export class AmazonSessionExpiredError extends Error {
  constructor() {
    super("The Amazon session has expired. Please sign in again.");
    this.name = "AmazonSessionExpiredError";
  }
}

/**
 * Checks whether the current Amazon session (held entirely in the CDP
 * browser's own profile directory, see AmazonAuthService) is still
 * valid, without ever reading or logging cookies/tokens directly: it
 * loads the notebook page in a hidden (headless) browser process on the
 * same profile and checks where navigation actually lands - the reader
 * itself (valid session) or an Amazon sign-in page (expired/no
 * session).
 */
export interface AmazonSessionService {
  isSessionValid(region: AmazonRegion): Promise<boolean>;
}

export class CdpAmazonSessionService implements AmazonSessionService {
  constructor(
    private readonly getProfileDir: () => string,
    private readonly logger: Logger,
  ) {}

  async isSessionValid(region: AmazonRegion): Promise<boolean> {
    this.logger.info("Checking Amazon session...");
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
      const loaded = page.waitForLoad();
      await page.navigate(region.notebookUrl);
      await withTimeout(
        loaded,
        PAGE_LOAD_TIMEOUT_MS,
        "Timed out waiting for the Kindle notebook page to finish loading.",
      );
      const finalUrl = await page.getCurrentUrl();
      const valid =
        finalUrl.startsWith(region.kindleReaderUrl) && !finalUrl.includes(SIGN_IN_URL_MARKER);
      this.logger.info(valid ? "Amazon session is valid." : "Amazon session is not valid.", {
        origin: safeUrlOrigin(finalUrl),
      });
      return valid;
    } catch (error) {
      this.logger.warn("Amazon session check failed", {
        message: error instanceof Error ? error.message : String(error),
      });
      return false;
    } finally {
      browser.close();
    }
  }
}
