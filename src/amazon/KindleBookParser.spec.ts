import { describe, expect, it } from "vitest";
import { getAmazonRegion } from "./AmazonRegion";
import { parseBookList } from "./KindleBookParser";
import { KindleParseError } from "./KindleParseError";

describe("parseBookList", () => {
  it("rejects empty HTML with a KindleParseError", () => {
    expect(() => parseBookList("", getAmazonRegion("jp"))).toThrow(KindleParseError);
  });

  it("is not yet implemented (Phase 2) but fails safely, not silently", () => {
    expect(() => parseBookList("<html></html>", getAmazonRegion("jp"))).toThrow(
      /Amazon's page structure may have changed/,
    );
  });
});
