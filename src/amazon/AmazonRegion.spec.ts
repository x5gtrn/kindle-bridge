import { describe, expect, it } from "vitest";
import {
  AMAZON_REGIONS,
  DEFAULT_AMAZON_REGION_ID,
  UnknownAmazonRegionError,
  getAmazonRegion,
  isKnownAmazonRegionId,
  listAmazonRegions,
} from "./AmazonRegion";

describe("AmazonRegion registry", () => {
  it("ships jp and global, confirmed working against real accounts", () => {
    expect(Object.keys(AMAZON_REGIONS)).toEqual(
      expect.arrayContaining(["jp", "global"]),
    );
  });

  it("ships uk/de/fr/es/it/nl as registry scaffolding only (unverified - docs/risks.md R-20)", () => {
    expect(Object.keys(AMAZON_REGIONS).sort()).toEqual([
      "de",
      "es",
      "fr",
      "global",
      "it",
      "jp",
      "nl",
      "uk",
    ]);
    for (const id of ["uk", "de", "fr", "es", "it", "nl"]) {
      expect(getAmazonRegion(id).label).toContain("unverified");
    }
  });

  it("defaults to jp", () => {
    expect(DEFAULT_AMAZON_REGION_ID).toBe("jp");
    expect(isKnownAmazonRegionId(DEFAULT_AMAZON_REGION_ID)).toBe(true);
  });

  it("returns the matching region config", () => {
    expect(getAmazonRegion("jp").amazonDomain).toBe("amazon.co.jp");
    expect(getAmazonRegion("global").amazonDomain).toBe("amazon.com");
  });

  it("gives each new region its localized reader subdomain, not a plain read. prefix", () => {
    expect(getAmazonRegion("de").kindleReaderUrl).toBe("https://lesen.amazon.de");
    expect(getAmazonRegion("fr").kindleReaderUrl).toBe("https://lire.amazon.fr");
    expect(getAmazonRegion("es").kindleReaderUrl).toBe("https://leer.amazon.es");
    expect(getAmazonRegion("it").kindleReaderUrl).toBe("https://leggi.amazon.it");
    expect(getAmazonRegion("nl").kindleReaderUrl).toBe("https://lezen.amazon.nl");
    // Unlike the others, UK uses English and a plain "read." prefix.
    expect(getAmazonRegion("uk").kindleReaderUrl).toBe("https://read.amazon.co.uk");
  });

  it("throws a typed error for a genuinely unknown region id", () => {
    expect(() => getAmazonRegion("br")).toThrow(UnknownAmazonRegionError);
  });

  it("lists all registered regions", () => {
    expect(listAmazonRegions()).toHaveLength(8);
  });
});
