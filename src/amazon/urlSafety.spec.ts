import { describe, expect, it } from "vitest";
import { safeUrlOrigin } from "./urlSafety";

describe("safeUrlOrigin", () => {
  it("returns only the origin, dropping path/query/fragment", () => {
    expect(safeUrlOrigin("https://read.amazon.co.jp/notebook?asin=B012345678&token=secret")).toBe(
      "https://read.amazon.co.jp",
    );
  });

  it("returns a placeholder for unparseable input instead of throwing", () => {
    expect(safeUrlOrigin("not a url")).toBe("[unparseable url]");
  });
});
