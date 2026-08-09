import { App, Modal } from "obsidian";
import type { SyncResult } from "../sync/SyncProgress";

/** Shows a completed sync's result summary (spec: "display of sync result"). */
export class SyncProgressModal extends Modal {
  constructor(
    app: App,
    private readonly result: SyncResult,
  ) {
    super(app);
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl("h2", { text: "Kindle Bridge sync complete" });

    const list = contentEl.createEl("ul");
    const rows: Array<[string, number]> = [
      ["Books found", this.result.booksFound],
      ["Notes created", this.result.notesCreated],
      ["Notes updated", this.result.notesUpdated],
      ["Highlights fetched", this.result.highlightsFetched],
      ["Highlight notes fetched", this.result.highlightNotesFetched],
      ["Skipped", this.result.skipped],
      ["Already up to date", this.result.skippedUpToDate],
      ["Flagged as removed from library", this.result.notesFlaggedRemoved],
      ["Errors", this.result.errors],
    ];
    for (const [label, value] of rows) {
      list.createEl("li", { text: `${label}: ${value}` });
    }
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
