import { toIsoDateString } from "../utils/dates";
import type { AmazonRegion } from "./AmazonRegion";

const JP_DATE_PATTERN = /^(\d{4})年(\d{1,2})月(\d{1,2})日$/;

/**
 * Amazon renders dates as locale-formatted text with no machine-readable
 * attribute, so each locale needs its own parsing rule (this is a known
 * brittleness point - see docs/risks.md R-07, R-10). Returns undefined
 * (never throws) when the value is missing or doesn't match the expected
 * format for the region, since a missing annotation date is a normal,
 * expected condition, not a parse failure.
 */
export function parseAmazonDate(
  rawValue: string | undefined,
  region: AmazonRegion,
): string | undefined {
  if (!rawValue) {
    return undefined;
  }
  const trimmed = rawValue.trim();
  if (trimmed.length === 0) {
    return undefined;
  }

  if (region.locale === "ja-JP") {
    // Confirmed against a real, live JP-region account (2026-08-10):
    // Amazon doesn't always render this date in Japanese for a JP
    // account - it's apparently tied to some other locale setting
    // (browser/OS/Amazon language preference), not strictly the
    // account's region. A value like "Sunday, August 9, 2026" would
    // silently fail JP_DATE_PATTERN and be dropped entirely; falling
    // through to the generic parser instead of giving up recovers it.
    return parseJapaneseDate(trimmed) ?? parseEnglishDate(trimmed);
  }
  return parseEnglishDate(trimmed);
}

function parseJapaneseDate(value: string): string | undefined {
  const match = JP_DATE_PATTERN.exec(value);
  if (!match) {
    return undefined;
  }
  const year = match[1];
  const month = match[2];
  const day = match[3];
  if (!year || !month || !day) {
    return undefined;
  }
  return buildIsoDate(Number(year), Number(month), Number(day));
}

function parseEnglishDate(value: string): string | undefined {
  // Non-ISO strings like "August 1, 2026" are parsed by JS as local
  // midnight. Re-reading the calendar fields with local getters (rather
  // than reusing the Date directly) and re-building at UTC midnight
  // avoids shifting the date by a day when the host timezone is ahead of
  // UTC (e.g. JST) - toIsoDateString() always renders in UTC.
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return undefined;
  }
  return buildIsoDate(parsed.getFullYear(), parsed.getMonth() + 1, parsed.getDate());
}

function buildIsoDate(year: number, month: number, day: number): string | undefined {
  const utcDate = new Date(Date.UTC(year, month - 1, day));
  return Number.isNaN(utcDate.getTime()) ? undefined : toIsoDateString(utcDate);
}
