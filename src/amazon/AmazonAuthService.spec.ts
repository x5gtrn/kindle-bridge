import { describe, expect, it } from "vitest";
import { getAmazonRegion } from "./AmazonRegion";
import { AmazonAuthUnsupportedError, ElectronAmazonAuthService } from "./AmazonAuthService";
import { Logger } from "../utils/logger";

// A fake App is enough here: none of these tests reach the point of
// actually constructing a Modal (signIn() isn't exercised - see the
// comment below), and signOut()/cancelPendingSignIn() never touch it.
const fakeApp = {} as import("obsidian").App;

describe("ElectronAmazonAuthService", () => {
  // signIn() now dynamically imports ui/AmazonSignInModal.ts, which
  // extends Obsidian's Modal - a real runtime value the `obsidian` npm
  // package doesn't provide (types only; see docs/architecture.md). So,
  // consistent with main.ts and every other ui/*.ts file in this
  // project, signIn()'s actual behavior can't be unit tested under
  // Vitest and is verified by manual testing instead - see
  // docs/manual-test-checklist.md and docs/risks.md R-05.

  it("throws AmazonAuthUnsupportedError instead of crashing when Electron's remote bridge is unavailable (signOut)", async () => {
    const service = new ElectronAmazonAuthService(fakeApp, new Logger({ level: "error" }));
    const region = getAmazonRegion("jp");
    await expect(service.signOut(region)).rejects.toThrow(AmazonAuthUnsupportedError);
  });

  it("cancelPendingSignIn() is a safe no-op when no sign-in is in progress", () => {
    // This is the common case: onunload() calls this unconditionally.
    const service = new ElectronAmazonAuthService(fakeApp, new Logger({ level: "error" }));
    expect(() => service.cancelPendingSignIn()).not.toThrow();
  });
});
