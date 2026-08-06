/** Region-specific calendar parsing lives in amazon/KindleBookParser and
 * amazon/KindleAnnotationParser (Phase 2). These helpers are generic and
 * used by the markdown layer for frontmatter timestamps.
 */

/** Returns the current instant as an ISO-8601 string, e.g. for `last_synced_at`. */
export function nowIsoTimestamp(): string {
  return new Date().toISOString();
}

/** Returns `YYYY-MM-DD` for a Date, used for date-only frontmatter fields. */
export function toIsoDateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Returns true if the value parses as a real calendar date. */
export function isValidDateString(value: string): boolean {
  const parsed = new Date(value);
  return !Number.isNaN(parsed.getTime());
}
