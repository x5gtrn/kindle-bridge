import type { Vault } from "obsidian";
import { NotImplementedYetError } from "../utils/errors";
import type { KindleAnnotation } from "../models/KindleAnnotation";
import type { KindleBook } from "../models/KindleBook";

export type BookNoteWriteOutcome = "created" | "updated" | "skipped";

/**
 * The only module allowed to touch the Obsidian Vault API for book
 * notes. Locates an existing note by book id (stored in frontmatter, not
 * by file name), sanitizes/disambiguates file names via
 * FileNameSanitizer, and on update replaces only the generated block
 * (see BookNoteRenderer) plus the plugin-owned frontmatter keys -
 * everything else in the file is left untouched. Implemented in Phase 3.
 */
export class BookNoteRepository {
  constructor(
    private readonly vault: Vault,
    private readonly outputFolder: string,
  ) {}

  /** Vault-relative path book notes are written into, e.g. for logging. */
  describeTarget(): string {
    return `${this.vault.getName()}/${this.outputFolder}`;
  }

  upsert(_book: KindleBook, _annotations: KindleAnnotation[]): Promise<BookNoteWriteOutcome> {
    throw new NotImplementedYetError("Book note persistence", "Phase 3");
  }
}
