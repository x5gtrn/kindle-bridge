import { isValidDateString, toIsoDateString } from "../utils/dates";

/**
 * Whether a book needs a fresh annotation fetch this sync. Compares
 * Amazon's book-level "last annotated" date (`lastAnnotatedAt`,
 * `YYYY-MM-DD` - see `KindleBookParser`) against the UTC calendar date
 * of this book's own last successful sync (`lastSyncedAt`, an ISO-8601
 * instant read back from a previous sync's `last_synced_at`
 * frontmatter). If the book wasn't annotated on or after that day,
 * nothing has changed on Amazon since - the annotation fetch (and note
 * write) for it can be skipped entirely this run.
 *
 * Defaults to `true` (sync) whenever either side is missing or
 * unparseable: a brand-new book (never synced), a book Amazon didn't
 * render a date for, or a corrupted/hand-edited frontmatter value all
 * fail open to a real sync rather than a silent skip.
 */
export function needsSync(
  lastAnnotatedAt: string | undefined,
  lastSyncedAt: string | undefined,
): boolean {
  if (!lastAnnotatedAt || !lastSyncedAt || !isValidDateString(lastSyncedAt)) {
    return true;
  }
  return lastAnnotatedAt >= toIsoDateString(new Date(lastSyncedAt));
}
