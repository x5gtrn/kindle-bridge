import { DEFAULT_AMAZON_REGION_ID, isKnownAmazonRegionId } from "../amazon/AmazonRegion";

/** Floor/ceiling for `autoSyncIntervalMinutes` - matches this project's
 * existing rate-limiting principle (docs/risks.md R-03/R-14/R-19):
 * automatic sync must never be able to hammer Amazon more often than a
 * manual, deliberate sync reasonably would. */
export const AUTO_SYNC_MIN_INTERVAL_MINUTES = 15;
export const AUTO_SYNC_MAX_INTERVAL_MINUTES = 360;

export interface KindleBridgeSettings {
  amazonRegion: string;
  outputFolder: string;
  displayCoverImage: boolean;
  debugLogging: boolean;
  /** Opt-in: append a short sync summary line to today's Daily Note.
   * See DailyNoteAppender.ts and docs/risks.md R-18 for why this uses
   * its own folder/date-format settings instead of reading Obsidian's
   * actual Daily Notes plugin configuration (no official API exists). */
  dailyNoteSummaryEnabled: boolean;
  dailyNoteFolder: string;
  dailyNoteDateFormat: string;
  /** Opt-in: run a sync once Obsidian's layout is ready. Failures are
   * logged only, never shown as a Notice - see docs/risks.md R-19. */
  autoSyncOnStartup: boolean;
  /** Opt-in: run a sync every `autoSyncIntervalMinutes` while Obsidian
   * is open. Changing either field takes effect after a plugin
   * reload/Obsidian restart - the interval isn't re-registered live. */
  autoSyncIntervalEnabled: boolean;
  autoSyncIntervalMinutes: number;
}

export const DEFAULT_SETTINGS: KindleBridgeSettings = {
  amazonRegion: DEFAULT_AMAZON_REGION_ID,
  outputFolder: "Highlight and Note/Books",
  displayCoverImage: true,
  debugLogging: false,
  dailyNoteSummaryEnabled: false,
  dailyNoteFolder: "Daily Notes",
  dailyNoteDateFormat: "YYYY-MM-DD",
  autoSyncOnStartup: false,
  autoSyncIntervalEnabled: false,
  autoSyncIntervalMinutes: 60,
};

/**
 * Validates and fills in defaults for whatever `loadData()` returns.
 * Never trusts persisted data directly - an unrecognized region id (e.g.
 * from a downgrade or manual data.json edit) falls back to the default
 * instead of crashing the plugin on load.
 */
export function normalizeSettings(data: unknown): KindleBridgeSettings {
  const partial: Partial<KindleBridgeSettings> =
    typeof data === "object" && data !== null ? data : {};

  const amazonRegion =
    typeof partial.amazonRegion === "string" && isKnownAmazonRegionId(partial.amazonRegion)
      ? partial.amazonRegion
      : DEFAULT_SETTINGS.amazonRegion;

  const outputFolder =
    typeof partial.outputFolder === "string" && partial.outputFolder.trim().length > 0
      ? partial.outputFolder
      : DEFAULT_SETTINGS.outputFolder;

  const displayCoverImage =
    typeof partial.displayCoverImage === "boolean"
      ? partial.displayCoverImage
      : DEFAULT_SETTINGS.displayCoverImage;

  const debugLogging =
    typeof partial.debugLogging === "boolean"
      ? partial.debugLogging
      : DEFAULT_SETTINGS.debugLogging;

  const dailyNoteSummaryEnabled =
    typeof partial.dailyNoteSummaryEnabled === "boolean"
      ? partial.dailyNoteSummaryEnabled
      : DEFAULT_SETTINGS.dailyNoteSummaryEnabled;

  // Unlike outputFolder, an empty string is a valid value here (vault
  // root) - only a non-string persisted value falls back to default.
  const dailyNoteFolder =
    typeof partial.dailyNoteFolder === "string"
      ? partial.dailyNoteFolder
      : DEFAULT_SETTINGS.dailyNoteFolder;

  const dailyNoteDateFormat =
    typeof partial.dailyNoteDateFormat === "string" && partial.dailyNoteDateFormat.trim().length > 0
      ? partial.dailyNoteDateFormat
      : DEFAULT_SETTINGS.dailyNoteDateFormat;

  const autoSyncOnStartup =
    typeof partial.autoSyncOnStartup === "boolean"
      ? partial.autoSyncOnStartup
      : DEFAULT_SETTINGS.autoSyncOnStartup;

  const autoSyncIntervalEnabled =
    typeof partial.autoSyncIntervalEnabled === "boolean"
      ? partial.autoSyncIntervalEnabled
      : DEFAULT_SETTINGS.autoSyncIntervalEnabled;

  // Clamped (not just type-checked) since a hand-edited/downgraded
  // data.json isn't constrained by the settings UI's slider - see
  // AUTO_SYNC_MIN_INTERVAL_MINUTES/AUTO_SYNC_MAX_INTERVAL_MINUTES.
  const autoSyncIntervalMinutes =
    typeof partial.autoSyncIntervalMinutes === "number" &&
    Number.isFinite(partial.autoSyncIntervalMinutes)
      ? Math.min(
          AUTO_SYNC_MAX_INTERVAL_MINUTES,
          Math.max(AUTO_SYNC_MIN_INTERVAL_MINUTES, partial.autoSyncIntervalMinutes),
        )
      : DEFAULT_SETTINGS.autoSyncIntervalMinutes;

  return {
    amazonRegion,
    outputFolder,
    displayCoverImage,
    debugLogging,
    dailyNoteSummaryEnabled,
    dailyNoteFolder,
    dailyNoteDateFormat,
    autoSyncOnStartup,
    autoSyncIntervalEnabled,
    autoSyncIntervalMinutes,
  };
}
