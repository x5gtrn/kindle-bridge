import type { App } from "obsidian";
import type { Logger } from "../utils/logger";
import { AmazonAuthUnsupportedError, type AmazonLoginResult } from "./AmazonAuthTypes";
import type { AmazonRegion } from "./AmazonRegion";
import { SESSION_PARTITION, getElectronRemote } from "./electronRemote";

export { AmazonAuthUnsupportedError } from "./AmazonAuthTypes";
export type { AmazonLoginResult } from "./AmazonAuthTypes";

/**
 * Signs a user in/out of Amazon using Amazon's own official login page
 * rendered inside an embedded `<webview>` (see ui/AmazonSignInModal.ts).
 * Never collects or stores email, password, or OTP; never touches
 * cookies directly (see docs/architecture.md §4).
 */
export interface AmazonAuthService {
  signIn(region: AmazonRegion): Promise<AmazonLoginResult>;
  signOut(region: AmazonRegion): Promise<void>;
  cancelPendingSignIn(): void;
}

export class ElectronAmazonAuthService implements AmazonAuthService {
  /** The modal for an in-flight sign-in, if any - see
   * cancelPendingSignIn(). Typed loosely (just the one method this
   * class needs) so this file doesn't need a top-level import of
   * ui/AmazonSignInModal.ts, which itself imports Obsidian's Modal
   * class - a real runtime value the `obsidian` npm package doesn't
   * provide (types only), so importing it here would break this file
   * under Vitest. signIn() below loads it lazily instead. */
  private activeSignIn?: { cancel(): void };

  constructor(
    private readonly app: App,
    private readonly logger: Logger,
  ) {}

  async signIn(region: AmazonRegion): Promise<AmazonLoginResult> {
    const { AmazonSignInModal } = await import("../ui/AmazonSignInModal");
    const modal = new AmazonSignInModal(this.app, region, SESSION_PARTITION, this.logger);
    this.activeSignIn = modal;
    try {
      return await modal.waitForOutcome();
    } finally {
      if (this.activeSignIn === modal) {
        this.activeSignIn = undefined;
      }
    }
  }

  /**
   * Cancels an in-flight sign-in (closing its modal) if one is in
   * progress; a no-op otherwise. Called from main.ts's onunload() so a
   * pending sign-in never outlives the plugin instance - see
   * docs/mvp-acceptance-report.md.
   */
  cancelPendingSignIn(): void {
    this.activeSignIn?.cancel();
  }

  async signOut(_region: AmazonRegion): Promise<void> {
    const remote = getElectronRemote();
    if (!remote) {
      throw new AmazonAuthUnsupportedError();
    }
    await remote.session.fromPartition(SESSION_PARTITION).clearStorageData();
  }
}
