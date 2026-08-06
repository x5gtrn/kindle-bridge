export interface AmazonRegion {
  id: string;
  label: string;
  amazonDomain: string;
  kindleReaderUrl: string;
  notebookUrl: string;
  locale?: string;
}

/**
 * MVP ships exactly two regions (jp, global). Adding a region later is a
 * single registry entry plus parser fixtures - no other code should need
 * to change. Other Amazon locales use a localized "read" subdomain
 * (lire.amazon.fr, lesen.amazon.de, leer.amazon.es, leggi.amazon.it,
 * lezen.amazon.nl) rather than a plain "read." prefix; kept here as a
 * note for whoever adds the next region.
 */
export const AMAZON_REGIONS: Record<string, AmazonRegion> = {
  jp: {
    id: "jp",
    label: "Japan",
    amazonDomain: "amazon.co.jp",
    kindleReaderUrl: "https://read.amazon.co.jp",
    notebookUrl: "https://read.amazon.co.jp/notebook",
    locale: "ja-JP",
  },
  global: {
    id: "global",
    label: "Global / United States",
    amazonDomain: "amazon.com",
    kindleReaderUrl: "https://read.amazon.com",
    notebookUrl: "https://read.amazon.com/notebook",
    locale: "en-US",
  },
};

export const DEFAULT_AMAZON_REGION_ID = "jp";

export class UnknownAmazonRegionError extends Error {
  constructor(public readonly regionId: string) {
    super(`Unknown Amazon region: ${regionId}`);
    this.name = "UnknownAmazonRegionError";
  }
}

export function isKnownAmazonRegionId(id: string): boolean {
  return Object.prototype.hasOwnProperty.call(AMAZON_REGIONS, id);
}

export function getAmazonRegion(id: string): AmazonRegion {
  const region = AMAZON_REGIONS[id];
  if (!region) {
    throw new UnknownAmazonRegionError(id);
  }
  return region;
}

export function listAmazonRegions(): AmazonRegion[] {
  return Object.values(AMAZON_REGIONS);
}
