import { describe, expect, it, vi } from "vitest";
import type {
  ElectronBrowserWindow,
  ElectronNavigationEvent,
  ElectronWindowOpenHandlerDetails,
  ElectronWindowOpenHandlerResponse,
} from "./electronRemote";
import { getElectronRemote, keepNavigationEmbedded, safeUrlOrigin } from "./electronRemote";

function fakeBrowserWindow(): ElectronBrowserWindow & {
  loadURL: ReturnType<typeof vi.fn>;
  triggerNewWindow: (url: string) => ElectronWindowOpenHandlerResponse | undefined;
  /** Returns whether the will-navigate listener called preventDefault(). */
  triggerWillNavigate: (url: string) => boolean;
} {
  let openHandler:
    ((details: ElectronWindowOpenHandlerDetails) => ElectronWindowOpenHandlerResponse) | undefined;
  let willNavigateListener: ((event: ElectronNavigationEvent, url: string) => void) | undefined;

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
      let prevented = false;
      willNavigateListener?.({ preventDefault: () => (prevented = true) }, url);
      return prevented;
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

describe("keepNavigationEmbedded", () => {
  describe("new-window requests (window.open()/target=_blank)", () => {
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
  });

  describe("top-level page navigation (will-navigate)", () => {
    it("prevents the default navigation and loads the URL in the same window instead", () => {
      const win = fakeBrowserWindow();
      keepNavigationEmbedded(win);

      const prevented = win.triggerWillNavigate("https://www.amazon.co.jp/ap/signin");

      expect(prevented).toBe(true);
      expect(win.loadURL).toHaveBeenCalledWith("https://www.amazon.co.jp/ap/signin");
    });

    it("calls onIntercepted with the target URL", () => {
      const win = fakeBrowserWindow();
      const onIntercepted = vi.fn();
      keepNavigationEmbedded(win, onIntercepted);

      win.triggerWillNavigate("https://www.amazon.co.jp/ap/signin");

      expect(onIntercepted).toHaveBeenCalledWith("https://www.amazon.co.jp/ap/signin");
    });
  });
});
