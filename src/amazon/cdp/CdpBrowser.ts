import { spawn, type ChildProcess } from "node:child_process";
import { findBrowserExecutable } from "./browserExecutable";
import { CdpConnection } from "./CdpConnection";

const DEVTOOLS_WS_PATTERN = /DevTools listening on (ws:\/\/\S+)/;
const LAUNCH_TIMEOUT_MS = 20 * 1000;

/** Pure parsing logic split out from waitForDevToolsUrl() below so it's
 * unit-testable without spawning a real browser process. Chrome/Edge/
 * Chromium print a line like `DevTools listening on ws://127.0.0.1:PORT/
 * devtools/browser/<uuid>` to stderr once remote debugging is ready. */
export function extractDevToolsUrl(stderrText: string): string | undefined {
  return DEVTOOLS_WS_PATTERN.exec(stderrText)?.[1];
}

export interface CdpLaunchOptions {
  userDataDir: string;
  headless: boolean;
}

// Property-typed (not method-shorthand) throughout this interface so
// test fakes/mocks can reference individual members (e.g.
// vi.mocked(page.navigate)) without tripping
// @typescript-eslint/unbound-method.
export interface CdpPage {
  navigate: (url: string) => Promise<void>;
  getCurrentUrl: () => Promise<string>;
  getHtml: () => Promise<string>;
  onFrameNavigated: (listener: (url: string) => void) => void;
  /** Resolves on the next `Page.loadEventFired` for this page - i.e.
   * once the page (including any redirect chain Amazon's own server
   * issued) has actually finished loading, as opposed to navigate()'s
   * promise, which only resolves once navigation is committed. */
  waitForLoad: () => Promise<void>;
  /** Fires with the HTTP status of every top-level document response
   * (not sub-resources like scripts/images) - e.g. to detect a 429
   * rate-limit response, which no other CDP signal surfaces as clearly. */
  onDocumentResponse: (listener: (status: number, url: string) => void) => void;
}

interface RuntimeEvaluateResult {
  result: { value: string };
}

/**
 * Launches and drives a real, separate Chrome/Edge/Chromium process via
 * the Chrome DevTools Protocol (see CdpConnection.ts) - not a window or
 * webview embedded in Obsidian's own Electron process. This is a
 * deliberate architectural choice, not the first one tried: see
 * docs/risks.md R-05 for the full trail of why an embedded
 * `remote.BrowserWindow` and an embedded `<webview>` were both
 * abandoned (navigation was silently redirected to the system browser
 * by something outside this plugin's control, confirmed independent of
 * this plugin's own code). A genuinely separate browser process has no
 * relationship to Obsidian's own window/webContents policies at all.
 *
 * Every operation that needs a browser (sign-in, session check, page
 * fetch) launches a fresh process against the *same* persistent
 * `userDataDir`, so Amazon's session cookies carry over between
 * launches without this plugin ever reading or storing them itself -
 * the same principle as the `persist:` Electron session partition used
 * before this, just backed by the browser's own profile directory
 * instead.
 */
export class CdpBrowser {
  private readonly exitListeners = new Set<(code: number | null) => void>();

  private constructor(
    private readonly childProcess: ChildProcess,
    private readonly connection: CdpConnection,
  ) {
    this.childProcess.on("exit", (code) => {
      this.exitListeners.forEach((listener) => listener(code));
    });
  }

  // Property-typed (not method-shorthand) so test mocks (vi.mocked(...))
  // can reference it without tripping @typescript-eslint/unbound-method.
  static launch = async (options: CdpLaunchOptions): Promise<CdpBrowser> => {
    const executablePath = findBrowserExecutable();
    const args = [
      `--user-data-dir=${options.userDataDir}`,
      "--remote-debugging-port=0",
      "--no-first-run",
      "--no-default-browser-check",
      ...(options.headless ? ["--headless=new"] : []),
      // Always launch blank; callers create their own page via
      // newPage() + navigate() so there's a single, consistent code
      // path for tracking navigation (a URL passed as a CLI arg here
      // would open in a *different* tab than newPage() creates).
      "about:blank",
    ];

    const childProcess = spawn(executablePath, args, { stdio: ["ignore", "ignore", "pipe"] });
    const webSocketDebuggerUrl = await waitForDevToolsUrl(childProcess);
    const connection = await CdpConnection.connect(webSocketDebuggerUrl);
    return new CdpBrowser(childProcess, connection);
  };

  /** Fires if the browser process exits on its own (e.g. the user
   * closes the window) after a successful launch - as opposed to
   * exiting before ever becoming ready, which launch() itself rejects
   * with. */
  onExit(listener: (code: number | null) => void): void {
    this.exitListeners.add(listener);
  }

  async newPage(): Promise<CdpPage> {
    const { targetId } = await this.connection.send<{ targetId: string }>("Target.createTarget", {
      url: "about:blank",
    });
    const { sessionId } = await this.connection.send<{ sessionId: string }>(
      "Target.attachToTarget",
      { targetId, flatten: true },
    );

    await this.connection.send("Page.enable", {}, sessionId);
    await this.connection.send("Runtime.enable", {}, sessionId);
    await this.connection.send("Network.enable", {}, sessionId);

    const connection = this.connection;
    return {
      navigate: async (url: string) => {
        await connection.send("Page.navigate", { url }, sessionId);
      },
      getCurrentUrl: async () => {
        const evaluated = await connection.send<RuntimeEvaluateResult>(
          "Runtime.evaluate",
          { expression: "location.href", returnByValue: true },
          sessionId,
        );
        return evaluated.result.value;
      },
      getHtml: async () => {
        const evaluated = await connection.send<RuntimeEvaluateResult>(
          "Runtime.evaluate",
          { expression: "document.documentElement.outerHTML", returnByValue: true },
          sessionId,
        );
        return evaluated.result.value;
      },
      // Only one page is ever open per CdpBrowser instance (a fresh
      // process is launched per operation - see the class doc comment),
      // so events aren't filtered by sessionId; that would be needed if
      // this ever supported multiple concurrent pages.
      onFrameNavigated: (listener: (url: string) => void) => {
        connection.on("Page.frameNavigated", (params) => {
          const frame = (params as { frame?: { url?: string; parentId?: string } }).frame;
          if (frame?.url && !frame.parentId) {
            listener(frame.url);
          }
        });
      },
      waitForLoad: () =>
        new Promise<void>((resolve) => {
          const onLoad = () => {
            connection.off("Page.loadEventFired", onLoad);
            resolve();
          };
          connection.on("Page.loadEventFired", onLoad);
        }),
      onDocumentResponse: (listener: (status: number, url: string) => void) => {
        connection.on("Network.responseReceived", (params) => {
          const typed = params as {
            type?: string;
            response?: { status?: number; url?: string };
          };
          if (
            typed.type === "Document" &&
            typeof typed.response?.status === "number" &&
            typed.response.url
          ) {
            listener(typed.response.status, typed.response.url);
          }
        });
      },
    };
  }

  /** Clears all cookies for this browser's profile - used for sign-out.
   * A browser-level command; doesn't need an open page. */
  async clearCookies(): Promise<void> {
    await this.connection.send("Network.clearBrowserCookies");
  }

  close(): void {
    this.connection.close();
    this.childProcess.kill();
  }
}

function waitForDevToolsUrl(childProcess: ChildProcess): Promise<string> {
  return new Promise((resolve, reject) => {
    let buffer = "";

    const cleanup = () => {
      clearTimeout(timeoutHandle);
      childProcess.stderr?.off("data", onData);
      childProcess.off("error", onError);
      childProcess.off("exit", onExit);
    };

    const timeoutHandle = setTimeout(() => {
      cleanup();
      reject(new Error("Timed out waiting for the browser to start."));
    }, LAUNCH_TIMEOUT_MS);

    const onData = (chunk: Buffer) => {
      buffer += chunk.toString();
      const url = extractDevToolsUrl(buffer);
      if (url) {
        cleanup();
        resolve(url);
      }
    };
    const onError = (error: Error) => {
      cleanup();
      reject(error);
    };
    const onExit = (code: number | null) => {
      cleanup();
      reject(new Error(`Browser exited before becoming ready (code ${code ?? "unknown"}).`));
    };

    childProcess.stderr?.on("data", onData);
    childProcess.on("error", onError);
    childProcess.on("exit", onExit);
  });
}
