import { describe, expect, it } from "vitest";
import { getElectronRemote, safeUrlOrigin } from "./electronRemote";

describe("getElectronRemote", () => {
  it("degrades gracefully to undefined when electron isn't resolvable (e.g. under Vitest/Node)", () => {
    expect(getElectronRemote()).toBeUndefined();
  });
});

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
