/** Summary shown to the user after a sync run completes (spec: 同期結果). */
export interface SyncResult {
  booksFound: number;
  notesCreated: number;
  notesUpdated: number;
  highlightsFetched: number;
  memosFetched: number;
  skipped: number;
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
    memosFetched: 0,
    skipped: 0,
    notesFlaggedRemoved: 0,
    errors: 0,
  };
}
