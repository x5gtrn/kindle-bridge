import { spawn } from "node:child_process";
import { existsSync, lstatSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { hostname, tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { clearStaleSingletonLock, extractDevToolsUrl } from "./CdpBrowser";

describe("extractDevToolsUrl", () => {
  it("extracts the ws:// URL from Chrome's real stderr startup line", () => {
    const stderr =
      "[12345:0x0:INFO:CONSOLE] \n" +
      "DevTools listening on ws://127.0.0.1:54321/devtools/browser/1234abcd-5678-efgh-9012-ijklmnopqrst\n" +
      "[12345:0x0:INFO:CONSOLE] some other log line\n";
    expect(extractDevToolsUrl(stderr)).toBe(
      "ws://127.0.0.1:54321/devtools/browser/1234abcd-5678-efgh-9012-ijklmnopqrst",
    );
  });

  it("returns undefined when the line hasn't appeared yet", () => {
    expect(extractDevToolsUrl("[12345:0x0:INFO:CONSOLE] starting up...\n")).toBeUndefined();
  });

  it("returns undefined for empty input", () => {
    expect(extractDevToolsUrl("")).toBeUndefined();
  });

  it("stops the captured URL at the first whitespace", () => {
    const stderr = "DevTools listening on ws://127.0.0.1:9222/devtools/browser/id extra trailing text";
    expect(extractDevToolsUrl(stderr)).toBe("ws://127.0.0.1:9222/devtools/browser/id");
  });
});

// Chrome's SingletonLock mechanism (and this cleanup) is POSIX-only -
// see clearStaleSingletonLock()'s doc comment. Skipped on Windows
// rather than mocked, consistent with this project's preference for
// exercising real fs/process behavior over mocking it (see
// NodeWebSocket.spec.ts).
describe.skipIf(process.platform === "win32")("clearStaleSingletonLock", () => {
  let profileDir: string;

  afterEach(() => {
    rmSync(profileDir, { recursive: true, force: true });
  });

  function freshProfileDir(): string {
    profileDir = mkdtempSync(join(tmpdir(), "kindle-bridge-test-"));
    return profileDir;
  }

  // existsSync() follows symlinks (stat, not lstat), so it reports
  // false for a dangling symlink whose target doesn't really exist -
  // exactly what SingletonLock's fake "<hostname>-<pid>" target is in
  // these tests. lstatSync() checks the symlink file itself.
  function symlinkExists(path: string): boolean {
    try {
      lstatSync(path);
      return true;
    } catch {
      return false;
    }
  }

  it("does nothing when there's no SingletonLock", () => {
    const dir = freshProfileDir();
    expect(() => clearStaleSingletonLock(dir)).not.toThrow();
  });

  it("does nothing when SingletonLock exists but isn't a symlink", () => {
    const dir = freshProfileDir();
    writeFileSync(join(dir, "SingletonLock"), "not a symlink");

    clearStaleSingletonLock(dir);

    expect(existsSync(join(dir, "SingletonLock"))).toBe(true);
  });

  it("leaves the lock in place when the referenced process is still alive", () => {
    const dir = freshProfileDir();
    // The test runner's own process is unambiguously alive.
    symlinkSync(`${hostname()}-${process.pid}`, join(dir, "SingletonLock"));

    clearStaleSingletonLock(dir);

    expect(symlinkExists(join(dir, "SingletonLock"))).toBe(true);
  });

  it("removes SingletonLock/Socket/Cookie when the referenced process is confirmed dead", async () => {
    const dir = freshProfileDir();
    const child = spawn(process.execPath, ["-e", "process.exit(0)"]);
    const deadPid = child.pid;
    await new Promise((resolve) => child.on("exit", resolve));
    expect(deadPid).toBeDefined();

    symlinkSync(`${hostname()}-${deadPid}`, join(dir, "SingletonLock"));
    writeFileSync(join(dir, "SingletonSocket"), "");
    writeFileSync(join(dir, "SingletonCookie"), "");

    clearStaleSingletonLock(dir);

    expect(existsSync(join(dir, "SingletonLock"))).toBe(false);
    expect(existsSync(join(dir, "SingletonSocket"))).toBe(false);
    expect(existsSync(join(dir, "SingletonCookie"))).toBe(false);
  });
});
