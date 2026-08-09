import { describe, expect, it } from "vitest";
import {
  AUTO_SYNC_MAX_INTERVAL_MINUTES,
  AUTO_SYNC_MIN_INTERVAL_MINUTES,
  DEFAULT_SETTINGS,
  normalizeSettings,
} from "./KindleBridgeSettings";

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
      dailyNoteSummaryEnabled: true,
      dailyNoteFolder: "Journal",
      dailyNoteDateFormat: "YYYY/MM/DD",
      autoSyncOnStartup: true,
      autoSyncIntervalEnabled: true,
      autoSyncIntervalMinutes: 120,
    });
    expect(result).toEqual({
      amazonRegion: "global",
      outputFolder: "Books/Kindle",
      displayCoverImage: false,
      debugLogging: true,
      dailyNoteSummaryEnabled: true,
      dailyNoteFolder: "Journal",
      dailyNoteDateFormat: "YYYY/MM/DD",
      autoSyncOnStartup: true,
      autoSyncIntervalEnabled: true,
      autoSyncIntervalMinutes: 120,
    });
  });

  it("falls back to the default region for an unknown region id", () => {
    const result = normalizeSettings({ amazonRegion: "br" });
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

  it("treats an empty dailyNoteFolder as valid (vault root), unlike outputFolder", () => {
    const result = normalizeSettings({ dailyNoteFolder: "" });
    expect(result.dailyNoteFolder).toBe("");
  });

  it("falls back to the default dailyNoteFolder for a non-string value", () => {
    const result = normalizeSettings({ dailyNoteFolder: 42 });
    expect(result.dailyNoteFolder).toBe(DEFAULT_SETTINGS.dailyNoteFolder);
  });

  it("falls back to the default dailyNoteDateFormat for an empty/whitespace-only value", () => {
    expect(normalizeSettings({ dailyNoteDateFormat: "" }).dailyNoteDateFormat).toBe(
      DEFAULT_SETTINGS.dailyNoteDateFormat,
    );
    expect(normalizeSettings({ dailyNoteDateFormat: "   " }).dailyNoteDateFormat).toBe(
      DEFAULT_SETTINGS.dailyNoteDateFormat,
    );
  });

  it("ignores a wrong-typed dailyNoteSummaryEnabled field", () => {
    const result = normalizeSettings({ dailyNoteSummaryEnabled: "yes" });
    expect(result.dailyNoteSummaryEnabled).toBe(DEFAULT_SETTINGS.dailyNoteSummaryEnabled);
  });

  it("ignores wrong-typed autoSync boolean fields", () => {
    const result = normalizeSettings({
      autoSyncOnStartup: "yes",
      autoSyncIntervalEnabled: 1,
    });
    expect(result.autoSyncOnStartup).toBe(DEFAULT_SETTINGS.autoSyncOnStartup);
    expect(result.autoSyncIntervalEnabled).toBe(DEFAULT_SETTINGS.autoSyncIntervalEnabled);
  });

  it("clamps an autoSyncIntervalMinutes value below the minimum", () => {
    const result = normalizeSettings({ autoSyncIntervalMinutes: 1 });
    expect(result.autoSyncIntervalMinutes).toBe(AUTO_SYNC_MIN_INTERVAL_MINUTES);
  });

  it("clamps an autoSyncIntervalMinutes value above the maximum", () => {
    const result = normalizeSettings({ autoSyncIntervalMinutes: 10_000 });
    expect(result.autoSyncIntervalMinutes).toBe(AUTO_SYNC_MAX_INTERVAL_MINUTES);
  });

  it("keeps an autoSyncIntervalMinutes value within the valid range", () => {
    const result = normalizeSettings({ autoSyncIntervalMinutes: 90 });
    expect(result.autoSyncIntervalMinutes).toBe(90);
  });

  it("falls back to the default autoSyncIntervalMinutes for a non-numeric value", () => {
    expect(normalizeSettings({ autoSyncIntervalMinutes: "60" }).autoSyncIntervalMinutes).toBe(
      DEFAULT_SETTINGS.autoSyncIntervalMinutes,
    );
    expect(normalizeSettings({ autoSyncIntervalMinutes: NaN }).autoSyncIntervalMinutes).toBe(
      DEFAULT_SETTINGS.autoSyncIntervalMinutes,
    );
  });
});
