import { describe, expect, it, vi } from "vitest";
import type {
  ElectronBrowserWindow,
  ElectronWindowOpenHandlerDetails,
  ElectronWindowOpenHandlerResponse,
} from "./electronRemote";
import {
  getElectronRemote,
  keepNavigationEmbedded,
  observeTopLevelNavigation,
  safeUrlOrigin,
} from "./electronRemote";

function fakeBrowserWindow(): ElectronBrowserWindow & {
  loadURL: ReturnType<typeof vi.fn>;
  triggerNewWindow: (url: string) => ElectronWindowOpenHandlerResponse | undefined;
  triggerWillNavigate: (url: string) => void;
} {
  let openHandler:
    ((details: ElectronWindowOpenHandlerDetails) => ElectronWindowOpenHandlerResponse) | undefined;
  let willNavigateListener: ((event: { preventDefault(): void }, url: string) => void) | undefined;

  const win: ElectronBrowserWindow & { loadURL: ReturnType<typeof vi.fn> } = {
    loadURL: vi.fn().mockResolvedValue(undefined),
    show: () => undefined,
    close: () => undefined,
    isDestroyed: () => false,
    once: () => undefined,
    on: () => undefined,
    webContents: {
      getURL: () => "",
      executeJavaScript: <T>() => Promise.resolve(undefined as T),
      session: { clearStorageData: () => Promise.resolve() },
      on: (event: string, listener: unknown) => {
        if (event === "will-navigate") {
          willNavigateListener = listener as typeof willNavigateListener;
        }
      },
      setWindowOpenHandler: (handler) => {
        openHandler = handler;
      },
    },
  };

  return Object.assign(win, {
    triggerNewWindow: (url: string) => openHandler?.({ url }),
    triggerWillNavigate: (url: string) => {
      willNavigateListener?.({ preventDefault: () => undefined }, url);
    },
  });
}

describe("getElectronRemote", () => {
  it("degrades gracefully to undefined when electron isn't resolvable (e.g. under Vitest/Node)", () => {
    expect(getElectronRemote()).toBeUndefined();
  });
});

describe("safeUrlOrigin", () => {
  it("returns only the origin, dropping path/query/fragment", () => {
    expect(safeUrlOrigin("https://read.amazon.co.jp/notebook?asin=B012345678&token=secret")).toBe(
      "https://read.amazon.co.jp",
    );
  });

  it("returns a placeholder for unparseable input instead of throwing", () => {
    expect(safeUrlOrigin("not a url")).toBe("[unparseable url]");
  });
});

describe("keepNavigationEmbedded (new-window requests only)", () => {
  it("denies the new window and loads the URL in the same window instead", () => {
    const win = fakeBrowserWindow();
    keepNavigationEmbedded(win);

    const response = win.triggerNewWindow("https://www.amazon.co.jp/ap/signin");

    expect(response).toEqual({ action: "deny" });
    expect(win.loadURL).toHaveBeenCalledWith("https://www.amazon.co.jp/ap/signin");
  });

  it("calls onIntercepted with the target URL", () => {
    const win = fakeBrowserWindow();
    const onIntercepted = vi.fn();
    keepNavigationEmbedded(win, onIntercepted);

    win.triggerNewWindow("https://www.amazon.co.jp/ap/signin");

    expect(onIntercepted).toHaveBeenCalledWith("https://www.amazon.co.jp/ap/signin");
  });

  it("does not touch will-navigate at all - top-level navigation is left to observeTopLevelNavigation", () => {
    const win = fakeBrowserWindow();
    keepNavigationEmbedded(win);

    // No listener was attached by keepNavigationEmbedded, so this is a
    // no-op; loadURL must not have been called as a side effect of it.
    win.triggerWillNavigate("https://www.amazon.co.jp/ap/signin");

    expect(win.loadURL).not.toHaveBeenCalled();
  });
});

describe("observeTopLevelNavigation", () => {
  it("calls onNavigate with the target URL but never touches loadURL (no interference)", () => {
    const win = fakeBrowserWindow();
    const onNavigate = vi.fn();
    observeTopLevelNavigation(win, onNavigate);

    win.triggerWillNavigate("https://www.amazon.co.jp/ap/signin");

    expect(onNavigate).toHaveBeenCalledWith("https://www.amazon.co.jp/ap/signin");
    expect(win.loadURL).not.toHaveBeenCalled();
  });
});
