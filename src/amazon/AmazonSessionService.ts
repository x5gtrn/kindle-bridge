import { AmazonAuthUnsupportedError } from "./AmazonAuthTypes";
import type { AmazonRegion } from "./AmazonRegion";
import { BrowserNotFoundError } from "./cdp/browserExecutable";
import { CdpBrowser } from "./cdp/CdpBrowser";

const SIGN_IN_URL_MARKER = "/ap/signin";

/** Thrown when Amazon redirects to its sign-in page instead of serving
 * the requested page - a continuation-breaking error that must stop the
 * whole sync (spec: "認証切れなど、継続不能なエラーの場合のみ全体を停止"),
 * not just the single book being fetched. */
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
  constructor(private readonly getProfileDir: () => string) {}

  async isSessionValid(region: AmazonRegion): Promise<boolean> {
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
      await loaded;
      const finalUrl = await page.getCurrentUrl();
      return finalUrl.startsWith(region.kindleReaderUrl) && !finalUrl.includes(SIGN_IN_URL_MARKER);
    } catch {
      return false;
    } finally {
      browser.close();
    }
  }
}
