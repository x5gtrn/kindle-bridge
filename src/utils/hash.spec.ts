import { describe, expect, it } from "vitest";
import { normalizeForHash, sha256Hex } from "./hash";

describe("sha256Hex", () => {
  it("is deterministic for the same input", () => {
    expect(sha256Hex("hello")).toBe(sha256Hex("hello"));
  });

  it("produces different hashes for different input", () => {
    expect(sha256Hex("hello")).not.toBe(sha256Hex("world"));
  });

  it("produces a 64-character hex digest", () => {
    expect(sha256Hex("hello")).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("normalizeForHash", () => {
  it("collapses internal whitespace and trims", () => {
    expect(normalizeForHash("  hello\n  world  ")).toBe("hello world");
  });

  it("makes cosmetically-different text hash identically", () => {
    const a = normalizeForHash("hello   world");
    const b = normalizeForHash("hello\nworld");
    expect(sha256Hex(a)).toBe(sha256Hex(b));
  });
});
