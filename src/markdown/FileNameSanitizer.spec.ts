import { describe, expect, it } from "vitest";
import { buildBookFileName, sanitizeFileNameComponent } from "./FileNameSanitizer";

describe("sanitizeFileNameComponent", () => {
  it("passes through an already-safe title", () => {
    expect(sanitizeFileNameComponent("Atomic Habits")).toBe("Atomic Habits");
  });

  it("replaces characters illegal in file names", () => {
    const result = sanitizeFileNameComponent('Who: What? "Why"<>|/\\*');
    expect(result).not.toMatch(/[\\/:*?"<>|]/);
    expect(result.indexOf("Who")).toBeLessThan(result.indexOf("What"));
    expect(result.indexOf("What")).toBeLessThan(result.indexOf("Why"));
  });

  it("collapses internal whitespace", () => {
    expect(sanitizeFileNameComponent("Too   Many\n\tSpaces")).toBe("Too Many Spaces");
  });

  it("trims trailing dots and spaces", () => {
    expect(sanitizeFileNameComponent("Trailing dot.  ")).toBe("Trailing dot");
  });

  it("falls back to Untitled when nothing printable remains", () => {
    expect(sanitizeFileNameComponent("   ")).toBe("Untitled");
    expect(sanitizeFileNameComponent("...")).toBe("Untitled");
    expect(sanitizeFileNameComponent("")).toBe("Untitled");
  });

  it("does not produce an empty result for illegal-character-only input", () => {
    expect(sanitizeFileNameComponent("///").length).toBeGreaterThan(0);
  });

  it("truncates very long titles", () => {
    const longTitle = "A".repeat(300);
    expect(sanitizeFileNameComponent(longTitle).length).toBeLessThanOrEqual(150);
  });
});

describe("buildBookFileName", () => {
  it("builds a plain .md file name from the title", () => {
    expect(buildBookFileName("Atomic Habits")).toBe("Atomic Habits.md");
  });

  it("appends a disambiguator when provided", () => {
    expect(buildBookFileName("Atomic Habits", "B012345678")).toBe("Atomic Habits - B012345678.md");
  });

  it("sanitizes the disambiguator too", () => {
    expect(buildBookFileName("Title", "weird/id")).toBe("Title - weird-id.md");
  });
});
