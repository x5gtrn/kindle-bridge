import { DEFAULT_AMAZON_REGION_ID, isKnownAmazonRegionId } from "../amazon/AmazonRegion";

export interface KindleBridgeSettings {
  amazonRegion: string;
  outputFolder: string;
  displayCoverImage: boolean;
  debugLogging: boolean;
}

export const DEFAULT_SETTINGS: KindleBridgeSettings = {
  amazonRegion: DEFAULT_AMAZON_REGION_ID,
  outputFolder: "Highlight and Memo/Books",
  displayCoverImage: true,
  debugLogging: false,
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

  return { amazonRegion, outputFolder, displayCoverImage, debugLogging };
}
