import { describe, expect, it } from "vitest";
import { needsSync } from "./needsSync";

describe("needsSync", () => {
  it("returns true when the book has never been synced before", () => {
    expect(needsSync("2026-07-15", undefined)).toBe(true);
  });

  it("returns true when Amazon didn't render a last-annotated date", () => {
    expect(needsSync(undefined, "2026-07-20T00:00:00.000Z")).toBe(true);
  });

  it("returns false when the book wasn't annotated since its last sync", () => {
    expect(needsSync("2026-07-15", "2026-07-20T00:00:00.000Z")).toBe(false);
  });

  it("returns true when the book was annotated on the same UTC calendar day as its last sync", () => {
    expect(needsSync("2026-07-15", "2026-07-15T23:59:59.999Z")).toBe(true);
  });

  it("returns true when the book was annotated after its last sync", () => {
    expect(needsSync("2026-07-21", "2026-07-20T00:00:00.000Z")).toBe(true);
  });

  it("returns true for an unparseable lastSyncedAt instead of guessing", () => {
    expect(needsSync("2026-07-15", "not-a-date")).toBe(true);
  });
});
