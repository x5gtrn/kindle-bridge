import { NotImplementedYetError } from "../utils/errors";
import type { AmazonRegion } from "./AmazonRegion";

export type AmazonLoginResult =
  "success" | "cancelled" | "timeout" | "navigation-error" | "unsupported";

/**
 * Thrown when the host Obsidian/Electron build does not expose what this
 * plugin needs (BrowserWindow via a supported remote bridge) to show
 * Amazon's own login page safely. When this happens the plugin must
 * surface a clear error rather than fall back to an insecure method -
 * see docs/risks.md R-08.
 */
export class AmazonAuthUnsupportedError extends Error {
  constructor() {
    super("In-app Amazon sign-in isn't supported on this Obsidian/Electron version.");
    this.name = "AmazonAuthUnsupportedError";
  }
}

/**
 * Signs a user in/out of Amazon using Amazon's own official login page
 * rendered in an Electron window. Never collects or stores email,
 * password, or OTP; never touches cookies directly (see
 * docs/architecture.md §4). Implemented in Phase 3.
 */
export interface AmazonAuthService {
  signIn(region: AmazonRegion): Promise<AmazonLoginResult>;
  signOut(region: AmazonRegion): Promise<void>;
}

export class ElectronAmazonAuthService implements AmazonAuthService {
  signIn(_region: AmazonRegion): Promise<AmazonLoginResult> {
    throw new NotImplementedYetError("Amazon sign-in", "Phase 3");
  }

  signOut(_region: AmazonRegion): Promise<void> {
    throw new NotImplementedYetError("Amazon sign-out", "Phase 3");
  }
}
