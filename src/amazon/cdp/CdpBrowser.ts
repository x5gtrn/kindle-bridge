import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import { readlinkSync, rmSync } from "node:fs";
import { join } from "node:path";
import { findBrowserExecutable } from "./browserExecutable";
import { CdpConnection } from "./CdpConnection";

const DEVTOOLS_WS_PATTERN = /DevTools listening on (ws:\/\/\S+)/;
const LAUNCH_TIMEOUT_MS = 20 * 1000;
const SELECTOR_POLL_INTERVAL_MS = 300;
/** The three files Chrome's ProcessSingleton mechanism uses (POSIX
 * only) - see clearStaleSingletonLock() below. */
const SINGLETON_FILE_NAMES = ["SingletonLock", "SingletonSocket", "SingletonCookie"];

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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

/** What `clearStaleSingletonLock()` found and decided, returned (rather
 * than just logged) so `launch()` can fold it into its own failure
 * message if the subsequent launch attempt still fails - see
 * docs/risks.md R-05's 2026-08-10 entries for why this diagnostic
 * detail matters: the first version of this function was silent,
 * which made a recurrence of the same failure undiagnosable without a
 * separate round-trip asking the user to run shell commands. */
export type SingletonLockAction =
  | { kind: "none" }
  | { kind: "unparseable"; target: string }
  | { kind: "alive"; pid: number; command: string | undefined }
  | { kind: "cleared"; pid: number };

/**
 * Chrome's `SingletonLock` is a symlink (POSIX only - Chrome uses a
 * named mutex on Windows instead, so this is a no-op there) shaped
 * like `<hostname>-<pid>`, which Chrome uses to detect whether another
 * process already owns a given `--user-data-dir` before starting -
 * confirmed live (2026-08-10): a stale one left over from an earlier
 * crashed/leaked process makes every subsequent launch fail with
 * "Failed to create a ProcessSingleton... Aborting now to avoid
 * profile corruption," even though nothing is actually still running.
 *
 * This plugin's own design never intentionally runs two browser
 * processes against the same profile directory concurrently
 * (`SyncCoordinator`'s single-flight lock; one headless launch per
 * operation; `launch()`'s own try/catch already kills the process on
 * a post-spawn failure - see below). So any lock found here is either
 * already stale, or - more cautiously assumed - still legitimately
 * alive. Two checks decide which:
 *  1. A signal-0 `process.kill()` (tests liveness without sending a
 *     real signal) - a confirmed-dead pid (`ESRCH`) is unambiguous.
 *  2. For a pid that *is* alive: cross-checked against `ps`'s report
 *     of that pid's command name. PIDs get reused by the OS over
 *     time, so a lock referencing a pid that's alive right now doesn't
 *     by itself prove the *original* browser process is still the one
 *     holding it - if the live process clearly isn't a browser at all
 *     (chrome/chromium/edge/brave), the lock is stale-by-PID-reuse and
 *     just as safe to clear as a confirmed-dead one.
 * Only when the live pid's command can't be ruled out as a browser
 * (including when it can't be determined at all, e.g. `ps` itself
 * failing) is the lock left alone, and Chrome's own failure allowed to
 * surface as before - force-launching a second process against a
 * profile a real browser still owns is exactly the corruption scenario
 * Chrome's own check exists to prevent.
 */
export function clearStaleSingletonLock(
  userDataDir: string,
  // Injected (rather than always calling the real `ps`-based lookup
  // directly) so tests can exercise the "alive and looks like a
  // browser" / "alive, command unknown" branches deterministically,
  // without needing a real Chrome process to spawn - same DI pattern
  // as `formatDate` in DailyNoteAppender.ts.
  getProcessCommand: (pid: number) => string | undefined = getProcessCommandViaPs,
): SingletonLockAction {
  if (process.platform === "win32") {
    return { kind: "none" };
  }

  let target: string;
  try {
    target = readlinkSync(join(userDataDir, "SingletonLock"));
  } catch {
    return { kind: "none" }; // No lock, or not a symlink.
  }

  const pid = Number(target.slice(target.lastIndexOf("-") + 1));
  if (!Number.isInteger(pid)) {
    return { kind: "unparseable", target };
  }

  if (isProcessAlive(pid)) {
    const command = getProcessCommand(pid);
    if (!command || looksLikeBrowserProcess(command)) {
      // Alive and (looks like a browser, or we can't tell) - leave it.
      return { kind: "alive", pid, command };
    }
    // Alive, but clearly not a browser - the pid was reused after the
    // original process died; fall through and clear it below.
  }

  for (const name of SINGLETON_FILE_NAMES) {
    try {
      rmSync(join(userDataDir, name), { force: true });
    } catch {
      // Best-effort - if this fails, launch() proceeds and Chrome's
      // own error (if any) surfaces exactly as it did before this fix.
    }
  }
  return { kind: "cleared", pid };
}

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    // ESRCH = no such process, i.e. confirmed dead. Any other error
    // (e.g. EPERM) means we can't prove it's dead, so assume alive.
    return (error as NodeJS.ErrnoException).code !== "ESRCH";
  }
}

/** Best-effort - `undefined` (not a throw) if `ps` itself is
 * unavailable or the pid disappeared between the liveness check above
 * and this call; callers treat "unknown" the same as "might be a
 * browser" (conservative). */
function getProcessCommandViaPs(pid: number): string | undefined {
  try {
    return execFileSync("ps", ["-p", String(pid), "-o", "comm="], {
      encoding: "utf8",
      timeout: 2000,
    }).trim();
  } catch {
    return undefined;
  }
}

function looksLikeBrowserProcess(command: string): boolean {
  return /chrome|chromium|msedge|edge|brave/i.test(command);
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
  /** Polls (every `POLL_INTERVAL_MS`) for `document.querySelector(selector)`
   * to return a match, up to `timeoutMs`. Needed because `waitForLoad()`
   * only reflects the DOM `load` event - some of Amazon's own page
   * content (e.g. a book's highlights/notes) is fetched and rendered by
   * the page's own JavaScript *after* that event, so a caller that reads
   * `getHtml()` right after `waitForLoad()` alone can observe an empty
   * container that fills in moments later. Resolves `true` as soon as
   * found, or `false` on timeout (the caller decides whether that means
   * "genuinely empty" or "failed to render" - this never throws). */
  waitForSelector: (selector: string, timeoutMs: number) => Promise<boolean>;
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
    const lockAction = clearStaleSingletonLock(options.userDataDir);
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

    const childProcess = spawn(executablePath, args, { stdio: ["ignore", "pipe", "pipe"] });
    try {
      const webSocketDebuggerUrl = await waitForDevToolsUrl(childProcess, executablePath, lockAction);
      const connection = await CdpConnection.connect(webSocketDebuggerUrl);
      return new CdpBrowser(childProcess, connection);
    } catch (error) {
      // Chrome has already started by this point (waitForDevToolsUrl only
      // resolves once it has) - if connecting to it then fails, the
      // process would otherwise leak silently, permanently holding this
      // profile directory's singleton lock and causing every later launch
      // attempt to report "Opening in existing browser session." instead
      // of starting a fresh, controllable process.
      childProcess.kill();
      throw error;
    }
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
      waitForSelector: async (selector: string, timeoutMs: number) => {
        const deadline = Date.now() + timeoutMs;
        const expression = `document.querySelector(${JSON.stringify(selector)}) !== null`;
        for (;;) {
          const evaluated = await connection.send<{ result: { value: boolean } }>(
            "Runtime.evaluate",
            { expression, returnByValue: true },
            sessionId,
          );
          if (evaluated.result.value) {
            return true;
          }
          if (Date.now() >= deadline) {
            return false;
          }
          await sleep(SELECTOR_POLL_INTERVAL_MS);
        }
      },
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

/** Caps how much of the child process's stdout/stderr is echoed back in
 * a failure message - just enough to diagnose why launch failed (e.g.
 * Chrome's own "Opening in existing browser session." message when it
 * hands off to an already-running instance instead of starting a new,
 * controllable one) without dumping unbounded output into a Notice. */
const DIAGNOSTIC_OUTPUT_LIMIT = 2000;

/** Folds `clearStaleSingletonLock()`'s decision into a launch-failure
 * message when it's non-trivial (i.e. it found something and chose to
 * leave it alone) - see docs/risks.md R-05's 2026-08-10 entries for
 * why this matters: without it, a recurrence of the same failure gives
 * no signal on *why* the lock wasn't cleared this time. */
function describeLockAction(action: SingletonLockAction): string {
  switch (action.kind) {
    case "alive":
      return action.command
        ? ` A SingletonLock referencing pid ${action.pid} (command: "${action.command}") was found and left in place because that process still appears to be running.`
        : ` A SingletonLock referencing pid ${action.pid} was found; that pid appears alive but its command could not be determined, so it was left in place to be safe.`;
    case "unparseable":
      return ` A SingletonLock was found but its target ("${action.target}") didn't look like the expected "<hostname>-<pid>" shape, so it was left in place.`;
    case "cleared":
    case "none":
      return "";
  }
}

function waitForDevToolsUrl(
  childProcess: ChildProcess,
  executablePath: string,
  lockAction: SingletonLockAction,
): Promise<string> {
  return new Promise((resolve, reject) => {
    let stderrBuffer = "";
    let combinedBuffer = "";

    const cleanup = () => {
      clearTimeout(timeoutHandle);
      childProcess.stdout?.off("data", onStdoutData);
      childProcess.stderr?.off("data", onStderrData);
      childProcess.off("error", onError);
      childProcess.off("exit", onExit);
    };

    const describeFailure = (reason: string): Error => {
      const output = combinedBuffer.trim().slice(0, DIAGNOSTIC_OUTPUT_LIMIT);
      return new Error(
        `${reason} (launched "${executablePath}")` +
          (output.length > 0 ? ` - output: ${output}` : " - no output was produced.") +
          describeLockAction(lockAction),
      );
    };

    const timeoutHandle = setTimeout(() => {
      cleanup();
      reject(describeFailure("Timed out waiting for the browser to start."));
    }, LAUNCH_TIMEOUT_MS);

    const onStdoutData = (chunk: Buffer) => {
      combinedBuffer += chunk.toString();
    };
    const onStderrData = (chunk: Buffer) => {
      const text = chunk.toString();
      stderrBuffer += text;
      combinedBuffer += text;
      const url = extractDevToolsUrl(stderrBuffer);
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
      reject(describeFailure(`Browser exited before becoming ready (code ${code ?? "unknown"}).`));
    };

    childProcess.stdout?.on("data", onStdoutData);
    childProcess.stderr?.on("data", onStderrData);
    childProcess.on("error", onError);
    childProcess.on("exit", onExit);
  });
}
