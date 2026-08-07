import { describe, expect, it } from "vitest";
import { candidatesForPlatform } from "./browserExecutable";

describe("candidatesForPlatform", () => {
  it("returns macOS .app paths for darwin", () => {
    const candidates = candidatesForPlatform("darwin");
    expect(candidates.some((c) => c.includes("Google Chrome.app"))).toBe(true);
    expect(candidates.every((c) => c.startsWith("/Applications/"))).toBe(true);
  });

  it("returns .exe paths for win32", () => {
    const candidates = candidatesForPlatform("win32");
    expect(candidates.every((c) => c.endsWith(".exe"))).toBe(true);
    expect(candidates.some((c) => c.includes("chrome.exe"))).toBe(true);
    expect(candidates.some((c) => c.includes("msedge.exe"))).toBe(true);
  });

  it("returns /usr/bin-style paths for linux (and any other platform id)", () => {
    const candidates = candidatesForPlatform("linux");
    expect(candidates.some((c) => c.includes("google-chrome"))).toBe(true);
    expect(candidates.some((c) => c.includes("chromium"))).toBe(true);
  });

  it("never returns an empty list for a known platform", () => {
    for (const platformId of ["darwin", "win32", "linux", "freebsd"]) {
      expect(candidatesForPlatform(platformId).length).toBeGreaterThan(0);
    }
  });
});
