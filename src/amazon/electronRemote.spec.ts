import { describe, expect, it, vi } from "vitest";
import type {
  ElectronBrowserWindow,
  ElectronWindowOpenHandlerDetails,
  ElectronWindowOpenHandlerResponse,
} from "./electronRemote";
import { getElectronRemote, keepNavigationEmbedded, safeUrlOrigin } from "./electronRemote";

function fakeBrowserWindow(): ElectronBrowserWindow & {
  loadURL: ReturnType<typeof vi.fn>;
  capturedHandler?: (
    details: ElectronWindowOpenHandlerDetails,
  ) => ElectronWindowOpenHandlerResponse;
} {
  const win: ElectronBrowserWindow & {
    loadURL: ReturnType<typeof vi.fn>;
    capturedHandler?: (
      details: ElectronWindowOpenHandlerDetails,
    ) => ElectronWindowOpenHandlerResponse;
  } = {
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
      on: () => undefined,
      setWindowOpenHandler: (handler) => {
        win.capturedHandler = handler;
      },
    },
  };
  return win;
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
  it("registers a window-open handler that denies the new window", () => {
    const win = fakeBrowserWindow();
    keepNavigationEmbedded(win);

    expect(win.capturedHandler).toBeDefined();
    const response = win.capturedHandler?.({ url: "https://www.amazon.co.jp/ap/signin" });
    expect(response).toEqual({ action: "deny" });
  });

  it("loads the target URL in the same window instead of letting it open elsewhere", () => {
    const win = fakeBrowserWindow();
    keepNavigationEmbedded(win);

    win.capturedHandler?.({ url: "https://www.amazon.co.jp/ap/signin" });

    expect(win.loadURL).toHaveBeenCalledWith("https://www.amazon.co.jp/ap/signin");
  });
});
