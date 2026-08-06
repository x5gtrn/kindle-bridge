import { AmazonAuthUnsupportedError } from "./AmazonAuthService";
import type { AmazonRegion } from "./AmazonRegion";
import { SESSION_PARTITION, getElectronRemote } from "./electronRemote";

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
 * Checks whether the current Amazon session (held entirely in Electron's
 * session partition, see AmazonAuthService) is still valid, without ever
 * reading or logging cookies/tokens directly: it loads the notebook page
 * in a hidden window on the same partition and checks where navigation
 * actually lands - the reader itself (valid session) or an Amazon
 * sign-in page (expired/no session).
 */
export interface AmazonSessionService {
  isSessionValid(region: AmazonRegion): Promise<boolean>;
}

export class ElectronAmazonSessionService implements AmazonSessionService {
  async isSessionValid(region: AmazonRegion): Promise<boolean> {
    const remote = getElectronRemote();
    if (!remote) {
      throw new AmazonAuthUnsupportedError();
    }

    const win = new remote.BrowserWindow({
      show: false,
      webPreferences: { partition: SESSION_PARTITION },
    });
    try {
      await win.loadURL(region.notebookUrl);
      const finalUrl = win.webContents.getURL();
      return finalUrl.startsWith(region.kindleReaderUrl) && !finalUrl.includes(SIGN_IN_URL_MARKER);
    } catch {
      return false;
    } finally {
      if (!win.isDestroyed()) {
        win.close();
      }
    }
  }
}
