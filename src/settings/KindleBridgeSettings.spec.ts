import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, normalizeSettings } from "./KindleBridgeSettings";

describe("normalizeSettings", () => {
  it("returns defaults for undefined/null input", () => {
    expect(normalizeSettings(undefined)).toEqual(DEFAULT_SETTINGS);
    expect(normalizeSettings(null)).toEqual(DEFAULT_SETTINGS);
  });

  it("returns defaults for non-object input", () => {
    expect(normalizeSettings("garbage")).toEqual(DEFAULT_SETTINGS);
    expect(normalizeSettings(42)).toEqual(DEFAULT_SETTINGS);
  });

  it("keeps valid persisted values", () => {
    const result = normalizeSettings({
      amazonRegion: "global",
      outputFolder: "Books/Kindle",
      displayCoverImage: false,
      debugLogging: true,
    });
    expect(result).toEqual({
      amazonRegion: "global",
      outputFolder: "Books/Kindle",
      displayCoverImage: false,
      debugLogging: true,
    });
  });

  it("falls back to the default region for an unknown region id", () => {
    const result = normalizeSettings({ amazonRegion: "uk" });
    expect(result.amazonRegion).toBe(DEFAULT_SETTINGS.amazonRegion);
  });

  it("falls back to the default output folder for an empty string", () => {
    const result = normalizeSettings({ outputFolder: "   " });
    expect(result.outputFolder).toBe(DEFAULT_SETTINGS.outputFolder);
  });

  it("ignores wrong-typed boolean fields", () => {
    const result = normalizeSettings({
      displayCoverImage: "yes",
      debugLogging: 1,
    });
    expect(result.displayCoverImage).toBe(DEFAULT_SETTINGS.displayCoverImage);
    expect(result.debugLogging).toBe(DEFAULT_SETTINGS.debugLogging);
  });
});
