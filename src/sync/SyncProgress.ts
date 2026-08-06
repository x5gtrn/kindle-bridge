/** Summary shown to the user after a sync run completes (spec: 同期結果). */
export interface SyncResult {
  booksFound: number;
  notesCreated: number;
  notesUpdated: number;
  highlightsFetched: number;
  memosFetched: number;
  skipped: number;
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
    errors: 0,
  };
}
