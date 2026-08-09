import type { TAbstractFile, TFile, Vault } from "obsidian";
import type { SyncResult } from "../sync/SyncProgress";
import { joinVaultPath } from "../utils/vaultPath";

export interface DailyNoteAppenderOptions {
  folder: string;
  dateFormat: string;
}

/**
 * Appends a short sync summary line to today's Daily Note, using this
 * plugin's own folder/date-format settings rather than Obsidian's real
 * Daily Notes plugin configuration - there is no official, typed API
 * for that (checked node_modules/obsidian/obsidian.d.ts directly; only
 * undocumented internals expose it), which this plugin avoids
 * everywhere else. See docs/architecture.md §7 and docs/risks.md R-18.
 *
 * Never creates the Daily Note itself: doing so would pre-empt
 * Obsidian's own "open today's note" flow, which only applies the
 * user's template on first creation - a bare file created here first
 * would silently break that. If the file doesn't exist yet, this is a
 * no-op.
 */
export class DailyNoteAppender {
  constructor(
    private readonly vault: Vault,
    /** Injected (rather than importing `moment` from "obsidian"
     * directly) so this class stays unit-testable under Vitest, which
     * has no runtime `obsidian` module - same pattern as
     * `getDisplayCoverImage` elsewhere in this codebase. */
    private readonly formatDate: (format: string) => string,
  ) {}

  async appendSyncSummary(result: SyncResult, options: DailyNoteAppenderOptions): Promise<void> {
    if (!hasMeaningfulActivity(result)) {
      return;
    }

    const path = joinVaultPath(options.folder, `${this.formatDate(options.dateFormat)}.md`);
    const file = this.vault.getAbstractFileByPath(path);
    if (!isFile(file)) {
      return;
    }

    const line = buildSummaryLine(result);
    await this.vault.process(file, (data) => appendLine(data, line));
  }
}

function hasMeaningfulActivity(result: SyncResult): boolean {
  return result.notesCreated + result.notesUpdated + result.notesFlaggedRemoved > 0;
}

function buildSummaryLine(result: SyncResult): string {
  const parts = [
    `${result.notesCreated} created`,
    `${result.notesUpdated} updated`,
    `${result.notesFlaggedRemoved} flagged as removed`,
  ];
  return `- 📚 Kindle Bridge: ${parts.join(", ")} (${result.highlightsFetched} highlights, ${result.highlightNotesFetched} notes)`;
}

function appendLine(data: string, line: string): string {
  const trimmed = data.replace(/\n+$/, "");
  return trimmed.length > 0 ? `${trimmed}\n${line}\n` : `${line}\n`;
}

/** Duck-typed check (rather than `instanceof TFile`) so this module
 * never needs a runtime value from the `obsidian` package - the
 * inverse of BookNoteRepository.ts's `isFolder()` (a file is anything
 * that isn't a folder, per the same `children` array check). */
function isFile(node: TAbstractFile | null): node is TFile {
  return node !== null && !Array.isArray((node as Partial<TFile & { children: unknown }>).children);
}
