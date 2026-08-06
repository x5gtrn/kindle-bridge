import { describe, expect, it } from "vitest";
import { isValidDateString, nowIsoTimestamp, toIsoDateString } from "./dates";

describe("nowIsoTimestamp", () => {
  it("returns an ISO-8601 timestamp", () => {
    expect(nowIsoTimestamp()).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });
});

describe("toIsoDateString", () => {
  it("formats a date as YYYY-MM-DD", () => {
    expect(toIsoDateString(new Date("2026-08-06T18:00:00Z"))).toBe("2026-08-06");
  });
});

describe("isValidDateString", () => {
  it("accepts a well-formed date", () => {
    expect(isValidDateString("2026-08-06")).toBe(true);
  });

  it("rejects garbage input", () => {
    expect(isValidDateString("not-a-date")).toBe(false);
  });
});
