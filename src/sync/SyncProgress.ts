/** Summary shown to the user after a sync run completes (spec: "sync result"). */
export interface SyncResult {
  booksFound: number;
  /** Book-note *files* created/updated in the vault - not to be
   * confused with `highlightNotesFetched` below (an annotation type). */
  notesCreated: number;
  notesUpdated: number;
  highlightsFetched: number;
  /** Standalone/attached-to-a-highlight *annotation* notes fetched from
   * Amazon (`KindleAnnotation.type === "note"` or `.note !== undefined`)
   * - deliberately not named `notesFetched`, which would be easy to
   * confuse with `notesCreated`/`notesUpdated` (book-note files) above. */
  highlightNotesFetched: number;
  skipped: number;
  /** Books whose annotation fetch was skipped entirely this run because
   * `lastAnnotatedAt` (Amazon's book-level date) was before the UTC
   * calendar date of this book's own last successful sync - see
   * `needsSync()`. Distinct from `skipped` above, which is about a book
   * that *was* fetched but turned out to have nothing to write. */
  skippedUpToDate: number;
  /** Notes newly flagged this run as "book no longer in your Kindle
   * library" - see BookNoteRepository.flagRemovedBooks() and
   * docs/risks.md R-13. Not a running total: a note already flagged in
   * a previous sync isn't counted again. */
  notesFlaggedRemoved: number;
  errors: number;
}

export function emptySyncResult(): SyncResult {
  return {
    booksFound: 0,
    notesCreated: 0,
    notesUpdated: 0,
    highlightsFetched: 0,
    highlightNotesFetched: 0,
    skipped: 0,
    skippedUpToDate: 0,
    notesFlaggedRemoved: 0,
    errors: 0,
  };
}
