import { existsSync } from "node:fs";
import { platform } from "node:os";
import { join } from "node:path";

/**
 * Locates an installed Chrome/Edge/Chromium/Brave executable to drive
 * via CDP (see CdpBrowser.ts). This project deliberately does not
 * depend on Playwright/Puppeteer to launch or download a browser: that
 * was tried and found impossible to distribute as the single-file
 * `main.js` Obsidian Community Plugins expect (playwright-core reads
 * sibling files via `__dirname`-relative paths at runtime, which don't
 * survive esbuild bundling into one file) - see docs/risks.md R-05.
 * This only ever looks for a browser already installed by the user; it
 * never downloads one.
 */
export class BrowserNotFoundError extends Error {
  constructor() {
    super(
      "Could not find an installed Chrome, Edge, Chromium, or Brave browser. " +
        "Kindle Bridge needs one of these installed to sign in to Amazon.",
    );
    this.name = "BrowserNotFoundError";
  }
}

function macCandidates(): string[] {
  return [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
  ];
}

function windowsCandidates(): string[] {
  const programFiles = process.env["ProgramFiles"] ?? "C:\\Program Files";
  const programFilesX86 = process.env["ProgramFiles(x86)"] ?? "C:\\Program Files (x86)";
  const localAppData = process.env["LOCALAPPDATA"];

  const candidates = [
    join(programFiles, "Google\\Chrome\\Application\\chrome.exe"),
    join(programFilesX86, "Google\\Chrome\\Application\\chrome.exe"),
    join(programFiles, "Microsoft\\Edge\\Application\\msedge.exe"),
    join(programFilesX86, "Microsoft\\Edge\\Application\\msedge.exe"),
  ];
  if (localAppData) {
    candidates.push(join(localAppData, "Google\\Chrome\\Application\\chrome.exe"));
  }
  return candidates;
}

function linuxCandidates(): string[] {
  return [
    "/usr/bin/google-chrome-stable",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium-browser",
    "/usr/bin/chromium",
    "/usr/bin/microsoft-edge-stable",
    "/usr/bin/microsoft-edge",
    "/snap/bin/chromium",
  ];
}

/** Pure decision logic (which candidate list to use per OS), separated
 * from filesystem access so it's unit-testable without depending on
 * what's actually installed on the machine running the tests. */
export function candidatesForPlatform(platformId: string): string[] {
  switch (platformId) {
    case "darwin":
      return macCandidates();
    case "win32":
      return windowsCandidates();
    default:
      return linuxCandidates();
  }
}

export function findBrowserExecutable(): string {
  for (const candidate of candidatesForPlatform(platform())) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }
  throw new BrowserNotFoundError();
}
