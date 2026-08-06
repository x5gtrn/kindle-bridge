/**
 * Minimal typed surface of the Electron API this plugin needs to show
 * Amazon's real login page and re-use its session, plus a safe
 * accessor that degrades gracefully instead of crashing when it isn't
 * available. `electron` is provided by Obsidian's own runtime process
 * (see esbuild.config.mjs externals), not bundled as an npm dependency,
 * so under Vitest/Node - or on a future Obsidian/Electron build where
 * the (already deprecated) `remote` module has been removed entirely -
 * `getElectronRemote()` simply returns undefined. See
 * docs/architecture.md §4 and docs/risks.md R-08.
 */

/** Persistent Chromium session partition for the Amazon login/scrape
 * windows. The `persist:` prefix makes Electron store cookies for this
 * partition on disk automatically; this plugin never reads, writes, or
 * logs cookies itself. */
export const SESSION_PARTITION = "persist:obsidian-kindle-bridge";

export interface ElectronSession {
  clearStorageData(): Promise<void>;
}

export interface ElectronWindowOpenHandlerDetails {
  url: string;
}

export interface ElectronWindowOpenHandlerResponse {
  action: "deny" | "allow";
}

export interface ElectronWebContents {
  getURL(): string;
  executeJavaScript<T = unknown>(code: string): Promise<T>;
  session: ElectronSession;
  on(
    event: "did-navigate" | "did-navigate-in-page",
    listener: (
      event: unknown,
      url: string,
      httpResponseCode?: number,
      httpStatusText?: string,
    ) => void,
  ): void;
  on(
    event: "did-fail-load",
    listener: (event: unknown, errorCode: number, errorDescription: string) => void,
  ): void;
  /** See keepNavigationEmbedded() below - the reason this plugin sets
   * this handler at all. */
  setWindowOpenHandler(
    handler: (details: ElectronWindowOpenHandlerDetails) => ElectronWindowOpenHandlerResponse,
  ): void;
}

export interface ElectronBrowserWindow {
  webContents: ElectronWebContents;
  // Property-typed (not method-shorthand) so test fakes can pass a mock
  // function directly without tripping
  // @typescript-eslint/unbound-method.
  loadURL: (url: string) => Promise<void>;
  show(): void;
  close(): void;
  isDestroyed(): boolean;
  once(event: "ready-to-show", listener: () => void): void;
  on(event: "closed", listener: () => void): void;
}

export interface ElectronBrowserWindowOptions {
  width?: number;
  height?: number;
  show?: boolean;
  webPreferences?: {
    partition?: string;
  };
}

export interface ElectronBrowserWindowConstructor {
  new (options: ElectronBrowserWindowOptions): ElectronBrowserWindow;
}

export interface ElectronRemote {
  BrowserWindow: ElectronBrowserWindowConstructor;
}

interface ElectronModuleShape {
  remote?: ElectronRemote;
}

export function getElectronRemote(): ElectronRemote | undefined {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- runtime-provided global (Obsidian's Electron host), not a bundled npm dependency; must be a lazy require so a missing module degrades gracefully instead of crashing at load time.
    const electronModule = require("electron") as ElectronModuleShape;
    return electronModule.remote;
  } catch {
    return undefined;
  }
}

/**
 * Forces any "new window" navigation triggered from inside `win` (e.g.
 * a `target="_blank"` link, or `window.open()` - both common in login/
 * MFA flows) to load in `win` itself instead of escaping elsewhere.
 *
 * Without this, a new-window request left unhandled can be routed to
 * the OS's default system browser by an app-level policy outside this
 * plugin's control (Obsidian's own webContents configuration applies
 * process-wide, not just to Obsidian's main window) - stranding the
 * user mid-login with no way back into the plugin's window except
 * cancelling. This is exactly the failure mode documented in
 * docs/risks.md R-05 (also seen in the reference project's issue #337
 * during Phase 0 research): Amazon's sign-in flow can trigger a
 * new-window navigation partway through, and if it escapes, this
 * plugin has no visibility into whatever completes in that separate
 * browser - it isn't the same session partition, so even a successful
 * sign-in there doesn't help.
 *
 * Keeping the navigation inside `win` doesn't bypass any Amazon
 * security measure or fake anything - it's the standard Electron
 * mechanism for "this popup should stay embedded in my own window,"
 * and Amazon's own page still renders and behaves identically, just
 * inside our window instead of a new one.
 */
export function keepNavigationEmbedded(win: ElectronBrowserWindow): void {
  win.webContents.setWindowOpenHandler(({ url }) => {
    win.loadURL(url).catch(() => undefined);
    return { action: "deny" };
  });
}

/** Origin-only view of a URL, safe to log - never logs query strings or
 * fragments, which on Amazon's domains can carry session-ish tokens. */
export function safeUrlOrigin(url: string): string {
  try {
    return new URL(url).origin;
  } catch {
    return "[unparseable url]";
  }
}
