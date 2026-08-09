import { describe, expect, it } from "vitest";
import { getAmazonRegion } from "./AmazonRegion";
import { parseAmazonDate } from "./parseAmazonDate";

describe("parseAmazonDate", () => {
  it("parses the Japanese YYYY年M月D日 format", () => {
    expect(parseAmazonDate("2026年8月1日", getAmazonRegion("jp"))).toBe("2026-08-01");
  });

  it("parses single-digit month/day in the Japanese format", () => {
    expect(parseAmazonDate("2026年1月5日", getAmazonRegion("jp"))).toBe("2026-01-05");
  });

  it("parses the English long-form date used for global accounts", () => {
    expect(parseAmazonDate("August 1, 2026", getAmazonRegion("global"))).toBe("2026-08-01");
  });

  it("falls back to English parsing for the jp region when the Japanese format doesn't match (confirmed live, 2026-08-10)", () => {
    // A real JP-region account was observed rendering this date in
    // English ("Sunday, August 9, 2026") rather than Japanese - see
    // docs/risks.md R-02. Falling through to the generic parser
    // recovers it instead of silently dropping it.
    expect(parseAmazonDate("August 1, 2026", getAmazonRegion("jp"))).toBe("2026-08-01");
    expect(parseAmazonDate("Sunday, August 9, 2026", getAmazonRegion("jp"))).toBe("2026-08-09");
  });

  it("does not accept the Japanese format for the global region", () => {
    expect(parseAmazonDate("2026年8月1日", getAmazonRegion("global"))).toBeUndefined();
  });

  it("returns undefined for missing input", () => {
    expect(parseAmazonDate(undefined, getAmazonRegion("jp"))).toBeUndefined();
    expect(parseAmazonDate("", getAmazonRegion("jp"))).toBeUndefined();
    expect(parseAmazonDate("   ", getAmazonRegion("global"))).toBeUndefined();
  });

  it("returns undefined for unparseable garbage instead of throwing", () => {
    expect(parseAmazonDate("not a date", getAmazonRegion("global"))).toBeUndefined();
    expect(parseAmazonDate("not a date", getAmazonRegion("jp"))).toBeUndefined();
  });
});
