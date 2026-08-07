import type { Logger } from "../utils/logger";
import { AmazonAuthUnsupportedError, type AmazonLoginResult } from "./AmazonAuthTypes";
import type { AmazonRegion } from "./AmazonRegion";
import { BrowserNotFoundError } from "./cdp/browserExecutable";
import { CdpBrowser } from "./cdp/CdpBrowser";
import { safeUrlOrigin } from "./urlSafety";

export { AmazonAuthUnsupportedError } from "./AmazonAuthTypes";
export type { AmazonLoginResult } from "./AmazonAuthTypes";

const SIGN_IN_TIMEOUT_MS = 5 * 60 * 1000;

/**
 * Signs a user in/out of Amazon using Amazon's own official login page,
 * rendered in a real, separate Chrome/Edge/Chromium process driven via
 * CDP (see cdp/CdpBrowser.ts) - not a window or webview embedded in
 * Obsidian's own Electron process. This is the third design tried for
 * this: see docs/risks.md R-05 for why both an embedded
 * `remote.BrowserWindow` and an embedded `<webview>` were abandoned
 * (navigation was silently redirected to the system browser by
 * something outside this plugin's control, confirmed independent of
 * this plugin's own code). A genuinely separate browser process has no
 * relationship to Obsidian's own window/webContents policies at all.
 *
 * Never collects or stores email, password, or OTP; never touches
 * cookies directly - they live only in the browser's own profile
 * directory (see `getProfileDir`), the same principle as the
 * `persist:` Electron session partition used before this.
 */
export interface AmazonAuthService {
  signIn(region: AmazonRegion): Promise<AmazonLoginResult>;
  signOut(region: AmazonRegion): Promise<void>;
  cancelPendingSignIn(): void;
}

export class CdpAmazonAuthService implements AmazonAuthService {
  private activeBrowser?: CdpBrowser;

  constructor(
    /** Absolute filesystem path to a persistent, plugin-owned browser
     * profile directory - shared with AmazonSessionService and
     * KindleReaderClient so a session established here is usable by
     * them too. Read lazily (not just once at construction) so it can
     * depend on plugin state that's only available after onload(). */
    private readonly getProfileDir: () => string,
    private readonly logger: Logger,
  ) {}

  async signIn(region: AmazonRegion): Promise<AmazonLoginResult> {
    const browser = await this.launch(false);
    this.activeBrowser = browser;

    return new Promise<AmazonLoginResult>((resolve) => {
      let settled = false;
      const finish = (result: AmazonLoginResult): void => {
        if (settled) {
          return;
        }
        settled = true;
        clearTimeout(timeoutHandle);
        if (this.activeBrowser === browser) {
          this.activeBrowser = undefined;
        }
        browser.close();
        resolve(result);
      };

      const timeoutHandle = setTimeout(() => finish("timeout"), SIGN_IN_TIMEOUT_MS);
      browser.onExit(() => finish("cancelled"));

      browser
        .newPage()
        .then((page) => {
          page.onFrameNavigated((url) => {
            this.logger.debug("Amazon sign-in navigation", { origin: safeUrlOrigin(url) });
            if (url.startsWith(region.kindleReaderUrl)) {
              finish("success");
            }
          });
          return page.navigate(region.notebookUrl);
        })
        .catch(() => finish("navigation-error"));
    });
  }

  /**
   * Cancels an in-flight sign-in (closing its browser process) if one
   * is in progress; a no-op otherwise. Called from main.ts's
   * onunload() so a pending sign-in never outlives the plugin instance.
   */
  cancelPendingSignIn(): void {
    this.activeBrowser?.close();
    this.activeBrowser = undefined;
  }

  async signOut(_region: AmazonRegion): Promise<void> {
    const browser = await this.launch(true);
    try {
      await browser.clearCookies();
    } finally {
      browser.close();
    }
  }

  private async launch(headless: boolean): Promise<CdpBrowser> {
    try {
      return await CdpBrowser.launch({ userDataDir: this.getProfileDir(), headless });
    } catch (error) {
      if (error instanceof BrowserNotFoundError) {
        throw new AmazonAuthUnsupportedError();
      }
      throw error;
    }
  }
}
