import { describe, expect, it } from "vitest";
import { upsizeCoverImageUrl } from "./amazonImageUrl";

describe("upsizeCoverImageUrl", () => {
  it("rewrites a bare _SY<height> suffix to the default target size", () => {
    expect(upsizeCoverImageUrl("https://m.media-amazon.com/images/I/81W8knGT65L._SY160.jpg")).toBe(
      "https://m.media-amazon.com/images/I/81W8knGT65L._SY500.jpg",
    );
  });

  it("rewrites a bare _SX<width> suffix", () => {
    expect(upsizeCoverImageUrl("https://m.media-amazon.com/images/I/abc._SX106.jpg")).toBe(
      "https://m.media-amazon.com/images/I/abc._SX500.jpg",
    );
  });

  it("rewrites a size token wrapped with other modifiers", () => {
    expect(upsizeCoverImageUrl("https://m.media-amazon.com/images/I/abc._AC_SY160_.jpg")).toBe(
      "https://m.media-amazon.com/images/I/abc._AC_SY500_.jpg",
    );
  });

  it("accepts a custom target size", () => {
    expect(
      upsizeCoverImageUrl("https://m.media-amazon.com/images/I/abc._SY160.jpg", 800),
    ).toBe("https://m.media-amazon.com/images/I/abc._SY800.jpg");
  });

  it("leaves a URL with no recognized size suffix untouched", () => {
    const url = "https://m.media-amazon.com/images/I/jp-sample-cover-1.jpg";
    expect(upsizeCoverImageUrl(url)).toBe(url);
  });

  it("leaves a non-Amazon-shaped URL untouched instead of guessing", () => {
    const url = "https://example.com/cover.jpg";
    expect(upsizeCoverImageUrl(url)).toBe(url);
  });
});
