/**
 * Shared between AmazonAuthService.ts and ui/AmazonSignInModal.ts,
 * split into its own file to avoid a circular import between them
 * (AmazonAuthService dynamically imports the modal; the modal needs
 * these types/error from AmazonAuthService's "public" surface).
 */

// "unsupported" isn't a member of this union: when the sign-in webview
// never becomes usable, signIn() rejects with AmazonAuthUnsupportedError
// instead of resolving, so callers can't silently ignore it.
export type AmazonLoginResult = "success" | "cancelled" | "timeout" | "navigation-error";

/**
 * Thrown when the host Obsidian/Electron build does not expose what this
 * plugin needs to show Amazon's own login page safely. When this
 * happens the plugin must surface a clear error rather than fall back
 * to an insecure method - see docs/risks.md R-08.
 */
export class AmazonAuthUnsupportedError extends Error {
  constructor() {
    super("In-app Amazon sign-in isn't supported on this Obsidian/Electron version.");
    this.name = "AmazonAuthUnsupportedError";
  }
}
