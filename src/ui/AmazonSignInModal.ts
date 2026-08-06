import { Modal, type App } from "obsidian";
import { AmazonAuthUnsupportedError, type AmazonLoginResult } from "../amazon/AmazonAuthTypes";
import type { AmazonRegion } from "../amazon/AmazonRegion";
import { safeUrlOrigin } from "../amazon/electronRemote";
import type { Logger } from "../utils/logger";

const SIGN_IN_TIMEOUT_MS = 5 * 60 * 1000;
/** How long to wait for the <webview> to prove it's actually a working
 * Electron webview (via its first dom-ready) before giving up. A plain,
 * unsupported <webview> element never fires this - see docs/risks.md
 * R-08 and the class doc comment below. */
const CAPABILITY_TIMEOUT_MS = 15 * 1000;
/** Chromium's ERR_ABORTED (-3): fired for routine things like a
 * redirect superseding an in-flight load, not a real failure. */
const ERR_ABORTED = -3;

/**
 * Electron's `<webview>` tag isn't in TypeScript's DOM lib, and its
 * custom events carry properties (url, errorCode, ...) that a plain
 * `Event` doesn't have. These are the minimal shapes this modal reads -
 * see https://www.electronjs.org/docs/latest/api/webview-tag.
 */
interface WebviewElement extends HTMLElement {
  setAttribute(name: "src" | "partition" | "allowpopups", value: string): void;
}
interface WebviewNavigateEvent extends Event {
  url: string;
}
interface WebviewFailLoadEvent extends Event {
  errorCode: number;
  errorDescription: string;
}

/**
 * Hosts Amazon's real sign-in page inside an Electron `<webview>`
 * embedded directly in this modal - i.e. inside Obsidian's own window -
 * rather than a separate `BrowserWindow`. This is a deliberate change
 * from the original design (see docs/architecture.md §4): live testing
 * found that a separate `remote.BrowserWindow`'s navigation was
 * silently redirected to the system browser by something outside this
 * plugin's control on at least Obsidian 1.13.4 (docs/risks.md R-05),
 * confirmed independent of this plugin's own code and corroborated by
 * an identical, unresolved report against a different plugin using the
 * same approach. An embedded `<webview>` is a genuinely different
 * Electron mechanism that may not be subject to whatever policy
 * affects separate "pop-out" windows.
 *
 * `<webview>` requires `webviewTag: true` on the hosting window's
 * `webPreferences`, which this plugin cannot set (that's Obsidian's own
 * main-window configuration, not something a community plugin
 * controls). There's no synchronous way to detect support - an
 * unsupported `<webview>` just silently does nothing - so this modal
 * waits up to CAPABILITY_TIMEOUT_MS for a first `dom-ready` event
 * before concluding it isn't supported and rejecting with
 * AmazonAuthUnsupportedError.
 */
export class AmazonSignInModal extends Modal {
  private settled = false;
  private resolveOutcome?: (outcome: AmazonLoginResult) => void;
  private rejectOutcome?: (error: unknown) => void;
  private signInTimeoutHandle?: ReturnType<typeof setTimeout>;
  private capabilityTimeoutHandle?: ReturnType<typeof setTimeout>;

  constructor(
    app: App,
    private readonly region: AmazonRegion,
    private readonly partition: string,
    private readonly logger: Logger,
  ) {
    super(app);
  }

  /** Opens the modal and resolves once sign-in settles (success,
   * cancelled, timeout, or a navigation error), or rejects with
   * AmazonAuthUnsupportedError if <webview> never becomes usable. */
  waitForOutcome(): Promise<AmazonLoginResult> {
    return new Promise((resolve, reject) => {
      this.resolveOutcome = resolve;
      this.rejectOutcome = reject;
      this.open();
    });
  }

  onOpen(): void {
    const { contentEl, modalEl } = this;
    contentEl.empty();
    modalEl.addClass("kindle-bridge-signin-modal");
    modalEl.style.width = "480px";

    contentEl.createEl("h2", { text: `Sign in to Amazon (${this.region.label})` });

    const container = contentEl.createDiv();
    container.style.width = "100%";
    container.style.height = "620px";

    // Not created via Obsidian's createEl() helper - "webview" isn't a
    // known tag in the DOM typings it uses, and the raw DOM API is
    // simpler here regardless.
    const webview: WebviewElement = document.createElement("webview");
    webview.setAttribute("src", this.region.notebookUrl);
    webview.setAttribute("partition", this.partition);
    webview.style.width = "100%";
    webview.style.height = "100%";
    container.appendChild(webview);

    this.capabilityTimeoutHandle = setTimeout(() => {
      this.logger.warn("Amazon sign-in: <webview> never became ready; treating as unsupported");
      this.failUnsupported();
    }, CAPABILITY_TIMEOUT_MS);

    webview.addEventListener("dom-ready", () => {
      this.clearCapabilityTimeout();
    });

    webview.addEventListener("did-navigate", (event) => {
      this.clearCapabilityTimeout();
      const url = (event as WebviewNavigateEvent).url;
      this.logger.debug("Amazon sign-in: webview navigation", { origin: safeUrlOrigin(url) });
      if (url.startsWith(this.region.kindleReaderUrl)) {
        this.finish("success");
      }
    });

    webview.addEventListener("did-navigate-in-page", (event) => {
      const url = (event as WebviewNavigateEvent).url;
      if (url.startsWith(this.region.kindleReaderUrl)) {
        this.finish("success");
      }
    });

    webview.addEventListener("did-fail-load", (event) => {
      const failEvent = event as WebviewFailLoadEvent;
      if (failEvent.errorCode === ERR_ABORTED) {
        return;
      }
      this.clearCapabilityTimeout();
      this.logger.warn("Amazon sign-in: webview navigation failed", {
        errorCode: failEvent.errorCode,
        errorDescription: failEvent.errorDescription,
      });
      this.finish("navigation-error");
    });

    this.signInTimeoutHandle = setTimeout(() => this.finish("timeout"), SIGN_IN_TIMEOUT_MS);
  }

  onClose(): void {
    this.contentEl.empty();
    this.finish("cancelled");
  }

  /** Cancels this sign-in attempt (same effect as the user closing the
   * modal). Safe to call even if already settled - see
   * AmazonAuthService.cancelPendingSignIn(). */
  cancel(): void {
    this.finish("cancelled");
  }

  private finish(outcome: AmazonLoginResult): void {
    if (this.settled) {
      return;
    }
    this.settled = true;
    this.clearCapabilityTimeout();
    if (this.signInTimeoutHandle) {
      clearTimeout(this.signInTimeoutHandle);
    }
    this.resolveOutcome?.(outcome);
    this.close();
  }

  private failUnsupported(): void {
    if (this.settled) {
      return;
    }
    this.settled = true;
    if (this.signInTimeoutHandle) {
      clearTimeout(this.signInTimeoutHandle);
    }
    this.rejectOutcome?.(new AmazonAuthUnsupportedError());
    this.close();
  }

  private clearCapabilityTimeout(): void {
    if (this.capabilityTimeoutHandle) {
      clearTimeout(this.capabilityTimeoutHandle);
      this.capabilityTimeoutHandle = undefined;
    }
  }
}
