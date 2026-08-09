import { DEFAULT_AMAZON_REGION_ID, isKnownAmazonRegionId } from "../amazon/AmazonRegion";

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
}

export const DEFAULT_SETTINGS: KindleBridgeSettings = {
  amazonRegion: DEFAULT_AMAZON_REGION_ID,
  outputFolder: "Highlight and Memo/Books",
  displayCoverImage: true,
  debugLogging: false,
  dailyNoteSummaryEnabled: false,
  dailyNoteFolder: "Daily Notes",
  dailyNoteDateFormat: "YYYY-MM-DD",
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

  return {
    amazonRegion,
    outputFolder,
    displayCoverImage,
    debugLogging,
    dailyNoteSummaryEnabled,
    dailyNoteFolder,
    dailyNoteDateFormat,
  };
}
