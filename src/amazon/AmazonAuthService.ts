import type { Logger } from "../utils/logger";
import type { AmazonRegion } from "./AmazonRegion";
import {
  SESSION_PARTITION,
  getElectronRemote,
  keepNavigationEmbedded,
  safeUrlOrigin,
} from "./electronRemote";

// "unsupported" isn't a member of this union: when Electron's remote
// bridge isn't available, signIn() throws AmazonAuthUnsupportedError
// instead of resolving, so callers can't silently ignore it.
export type AmazonLoginResult = "success" | "cancelled" | "timeout" | "navigation-error";

const LOGIN_WINDOW_WIDTH = 450;
const LOGIN_WINDOW_HEIGHT = 730;
const LOGIN_TIMEOUT_MS = 5 * 60 * 1000;

/**
 * Thrown when the host Obsidian/Electron build does not expose what this
 * plugin needs (BrowserWindow via a supported remote bridge) to show
 * Amazon's own login page safely. When this happens the plugin must
 * surface a clear error rather than fall back to an insecure method -
 * see docs/risks.md R-08.
 */
export class AmazonAuthUnsupportedError extends Error {
  constructor() {
    super("In-app Amazon sign-in isn't supported on this Obsidian/Electron version.");
    this.name = "AmazonAuthUnsupportedError";
  }
}

/**
 * Signs a user in/out of Amazon using Amazon's own official login page
 * rendered in an Electron window. Never collects or stores email,
 * password, or OTP; never touches cookies directly (see
 * docs/architecture.md §4).
 */
export interface AmazonAuthService {
  signIn(region: AmazonRegion): Promise<AmazonLoginResult>;
  signOut(region: AmazonRegion): Promise<void>;
}

export class ElectronAmazonAuthService implements AmazonAuthService {
  /** Cancels the in-flight sign-in, if any - see cancelPendingSignIn(). */
  private pendingCancel?: () => void;

  constructor(private readonly logger: Logger) {}

  signIn(region: AmazonRegion): Promise<AmazonLoginResult> {
    const remote = getElectronRemote();
    if (!remote) {
      throw new AmazonAuthUnsupportedError();
    }

    return new Promise<AmazonLoginResult>((resolve) => {
      const win = new remote.BrowserWindow({
        width: LOGIN_WINDOW_WIDTH,
        height: LOGIN_WINDOW_HEIGHT,
        show: false,
        webPreferences: { partition: SESSION_PARTITION },
      });
      keepNavigationEmbedded(win, (url) => {
        this.logger.debug(
          "Amazon login navigation kept embedded (would otherwise have escaped the window)",
          {
            origin: safeUrlOrigin(url),
          },
        );
      });

      let settled = false;

      const finish = (result: AmazonLoginResult): void => {
        if (settled) {
          return;
        }
        settled = true;
        clearTimeout(timeoutHandle);
        this.pendingCancel = undefined;
        if (!win.isDestroyed()) {
          win.close();
        }
        resolve(result);
      };

      this.pendingCancel = () => finish("cancelled");

      const timeoutHandle = setTimeout(() => finish("timeout"), LOGIN_TIMEOUT_MS);

      win.once("ready-to-show", () => win.show());

      win.webContents.on("did-navigate", (_event, url) => {
        this.logger.debug("Amazon login navigation", { origin: safeUrlOrigin(url) });
        if (url.startsWith(region.kindleReaderUrl)) {
          finish("success");
        }
      });
      win.webContents.on("did-navigate-in-page", (_event, url) => {
        if (url.startsWith(region.kindleReaderUrl)) {
          finish("success");
        }
      });
      win.webContents.on("did-fail-load", (_event, errorCode) => {
        this.logger.warn("Amazon login navigation failed", { errorCode });
        finish("navigation-error");
      });
      win.on("closed", () => finish("cancelled"));

      win.loadURL(region.notebookUrl).catch(() => finish("navigation-error"));
    });
  }

  /**
   * Cancels an in-flight sign-in (closing its window and clearing its
   * timeout) if one is in progress; a no-op otherwise. Called from
   * main.ts's onunload() so a pending 5-minute login timeout never
   * outlives the plugin instance - see docs/mvp-acceptance-report.md.
   */
  cancelPendingSignIn(): void {
    this.pendingCancel?.();
  }

  async signOut(_region: AmazonRegion): Promise<void> {
    const remote = getElectronRemote();
    if (!remote) {
      throw new AmazonAuthUnsupportedError();
    }
    const win = new remote.BrowserWindow({
      show: false,
      webPreferences: { partition: SESSION_PARTITION },
    });
    keepNavigationEmbedded(win);
    try {
      await win.webContents.session.clearStorageData();
    } finally {
      if (!win.isDestroyed()) {
        win.close();
      }
    }
  }
}
