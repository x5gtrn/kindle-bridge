export interface AmazonRegion {
  id: string;
  label: string;
  amazonDomain: string;
  kindleReaderUrl: string;
  notebookUrl: string;
  locale?: string;
}

/**
 * Adding a region is a single registry entry plus parser fixtures - no
 * other code should need to change, since parsers are structure-based,
 * not domain-based (locale only affects date parsing, isolated in
 * parseAmazonDate.ts). Other Amazon locales use a localized "read"
 * subdomain (lire.amazon.fr, lesen.amazon.de, leer.amazon.es,
 * leggi.amazon.it, lezen.amazon.nl) rather than a plain "read." prefix.
 *
 * `jp` and `global` are confirmed working against real accounts (see
 * docs/risks.md R-05). `uk`/`de`/`fr`/`es`/`it`/`nl` (added Phase 4,
 * 2026-08-10) are registry scaffolding only - **not verified against
 * any real account** - see docs/risks.md R-20. Their date parsing also
 * falls through to parseAmazonDate.ts's generic (English) fallback,
 * which does not understand German/French/Spanish/Italian/Dutch month
 * names; this fails closed (a missing `last_annotated_at`, never a
 * crash) rather than guessing at unverified locale-specific formats.
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
  uk: {
    id: "uk",
    label: "United Kingdom (unverified)",
    amazonDomain: "amazon.co.uk",
    kindleReaderUrl: "https://read.amazon.co.uk",
    notebookUrl: "https://read.amazon.co.uk/notebook",
    locale: "en-GB",
  },
  de: {
    id: "de",
    label: "Germany (unverified)",
    amazonDomain: "amazon.de",
    kindleReaderUrl: "https://lesen.amazon.de",
    notebookUrl: "https://lesen.amazon.de/notebook",
    locale: "de-DE",
  },
  fr: {
    id: "fr",
    label: "France (unverified)",
    amazonDomain: "amazon.fr",
    kindleReaderUrl: "https://lire.amazon.fr",
    notebookUrl: "https://lire.amazon.fr/notebook",
    locale: "fr-FR",
  },
  es: {
    id: "es",
    label: "Spain (unverified)",
    amazonDomain: "amazon.es",
    kindleReaderUrl: "https://leer.amazon.es",
    notebookUrl: "https://leer.amazon.es/notebook",
    locale: "es-ES",
  },
  it: {
    id: "it",
    label: "Italy (unverified)",
    amazonDomain: "amazon.it",
    kindleReaderUrl: "https://leggi.amazon.it",
    notebookUrl: "https://leggi.amazon.it/notebook",
    locale: "it-IT",
  },
  nl: {
    id: "nl",
    label: "Netherlands (unverified)",
    amazonDomain: "amazon.nl",
    kindleReaderUrl: "https://lezen.amazon.nl",
    notebookUrl: "https://lezen.amazon.nl/notebook",
    locale: "nl-NL",
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
