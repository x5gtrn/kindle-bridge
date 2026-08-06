import { describe, expect, it } from "vitest";
import { getAmazonRegion } from "./AmazonRegion";
import { parseAnnotations } from "./KindleAnnotationParser";
import { KindleParseError } from "./KindleParseError";

describe("parseAnnotations", () => {
  it("rejects empty HTML with a KindleParseError", () => {
    expect(() => parseAnnotations("", "book-1", getAmazonRegion("jp"))).toThrow(KindleParseError);
  });

  it("is not yet implemented (Phase 2) but fails safely, not silently", () => {
    expect(() => parseAnnotations("<html></html>", "book-1", getAmazonRegion("jp"))).toThrow(
      /Amazon's page structure may have changed/,
    );
  });
});
