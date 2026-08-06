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
  it("ships exactly jp and global for MVP", () => {
    expect(Object.keys(AMAZON_REGIONS).sort()).toEqual(["global", "jp"]);
  });

  it("defaults to jp", () => {
    expect(DEFAULT_AMAZON_REGION_ID).toBe("jp");
    expect(isKnownAmazonRegionId(DEFAULT_AMAZON_REGION_ID)).toBe(true);
  });

  it("returns the matching region config", () => {
    expect(getAmazonRegion("jp").amazonDomain).toBe("amazon.co.jp");
    expect(getAmazonRegion("global").amazonDomain).toBe("amazon.com");
  });

  it("throws a typed error for unknown region ids", () => {
    expect(() => getAmazonRegion("uk")).toThrow(UnknownAmazonRegionError);
  });

  it("lists all registered regions", () => {
    expect(listAmazonRegions()).toHaveLength(2);
  });
});
