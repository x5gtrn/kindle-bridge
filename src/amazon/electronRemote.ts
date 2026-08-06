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
}

export interface ElectronBrowserWindow {
  webContents: ElectronWebContents;
  loadURL(url: string): Promise<void>;
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

/** Origin-only view of a URL, safe to log - never logs query strings or
 * fragments, which on Amazon's domains can carry session-ish tokens. */
export function safeUrlOrigin(url: string): string {
  try {
    return new URL(url).origin;
  } catch {
    return "[unparseable url]";
  }
}
