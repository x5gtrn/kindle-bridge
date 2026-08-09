import type { FileManager, MetadataCache, TAbstractFile, TFile, TFolder, Vault } from "obsidian";
import type { KindleAnnotation } from "../models/KindleAnnotation";
import type { KindleBook } from "../models/KindleBook";
import { joinVaultPath } from "../utils/vaultPath";
import { buildBookFileName } from "./FileNameSanitizer";
import {
  GENERATED_BLOCK_END,
  GENERATED_BLOCK_START,
  MISSING_FROM_LIBRARY_BANNER,
  renderBookNote,
  type RenderBookNoteOptions,
} from "./BookNoteRenderer";

/** `"skipped"` means: no note exists yet for this book, and there's
 * nothing to write (zero current annotations) - never creates
 * empty-note clutter for books that have never been annotated. See
 * docs/risks.md R-13. */
export type BookNoteWriteOutcome = "created" | "updated" | "skipped";

export class VaultFolderCreationError extends Error {
  constructor(path: string) {
    super(`Could not create the output folder "${path}".`);
    this.name = "VaultFolderCreationError";
  }
}

export class MarkdownSaveError extends Error {
  constructor(path: string) {
    super(`Could not save the book note at "${path}".`);
    this.name = "MarkdownSaveError";
  }
}

/**
 * Thrown when an existing note is missing its generated-block markers
 * (e.g. a user deleted them). We deliberately refuse to guess where to
 * reinsert them rather than risk clobbering user content - the note is
 * skipped and reported to the user instead. See docs/architecture.md §7.
 */
export class GeneratedBlockMissingError extends Error {
  constructor(path: string) {
    super(
      `"${path}" is missing its Kindle Bridge managed-section markers (${GENERATED_BLOCK_START} / ${GENERATED_BLOCK_END}); skipping this note rather than guessing where to put updated highlights.`,
    );
    this.name = "GeneratedBlockMissingError";
  }
}

const FRONTMATTER_BOOK_ID_KEY = "kindle_book_id";
const FRONTMATTER_MISSING_KEY = "kindle_bridge_missing_from_library";
const FRONTMATTER_LAST_SYNCED_AT_KEY = "last_synced_at";
/** Renamed to `note_count` when "Memo" was renamed to "Note" throughout
 * (2026-08-10). `applyFrontmatter()` explicitly deletes this on every
 * write so an existing note doesn't end up with both the old and new
 * key - a plain `Object.assign()` merge would otherwise only ever add
 * the new key, never remove the old one. */
const LEGACY_MEMO_COUNT_FRONTMATTER_KEY = "memo_count";

/** What KindleSyncService needs from the repository - kept as an
 * interface (rather than depending on the concrete class directly) so
 * sync orchestration can be unit tested with a lightweight fake instead
 * of a full Obsidian Vault mock. */
export interface BookNoteWriter {
  // Property-typed (not method-shorthand) so callers can pass a mock
  // function directly in tests without tripping
  // @typescript-eslint/unbound-method.
  upsert: (
    book: KindleBook,
    annotations: KindleAnnotation[],
    options: RenderBookNoteOptions,
  ) => Promise<BookNoteWriteOutcome>;
  /** Flags every managed note whose book id isn't in `currentBookIds`
   * as no longer in the library (frontmatter key + an in-block banner
   * - never deletes or overwrites existing highlight content). Already-
   * flagged notes are skipped, so the returned count is only newly-
   * flagged notes this run. See docs/risks.md R-13. */
  flagRemovedBooks: (currentBookIds: Set<string>) => Promise<number>;
  /** The `last_synced_at` frontmatter value from this book's existing
   * note, if any - used by KindleSyncService (see `needsSync()`) to
   * decide whether a fresh annotation fetch is even necessary this run.
   * `undefined` for a book with no existing note (never synced) or a
   * note missing/with a non-string value for that key. */
  getLastSyncedAt: (bookId: string) => string | undefined;
}

/**
 * The only module allowed to touch the Obsidian Vault/FileManager API
 * for book notes. Locates an existing note by book id (stored in
 * frontmatter, not by file name, so renames survive resync), sanitizes/
 * disambiguates file names via FileNameSanitizer, and on update replaces
 * only the generated block (BookNoteRenderer) plus the plugin-owned
 * frontmatter keys - everything else in the file, including any
 * "## My Notes" content, is left untouched.
 */
export class BookNoteRepository implements BookNoteWriter {
  constructor(
    private readonly vault: Vault,
    private readonly metadataCache: MetadataCache,
    private readonly fileManager: FileManager,
    private readonly outputFolder: string,
  ) {}

  async upsert(
    book: KindleBook,
    annotations: KindleAnnotation[],
    options: RenderBookNoteOptions,
  ): Promise<BookNoteWriteOutcome> {
    const existing = this.findExistingNote(book.id);
    if (!existing && annotations.length === 0) {
      return "skipped";
    }

    await this.ensureOutputFolderExists();
    const rendered = renderBookNote(book, annotations, options);

    if (existing) {
      await this.updateNote(existing, rendered.frontmatter, rendered.generatedBlockBody);
      return "updated";
    }

    await this.createNote(book, rendered.initialBody, rendered.frontmatter);
    return "created";
  }

  /** Flags every managed note whose book id isn't in `currentBookIds`
   * - see the `BookNoteWriter.flagRemovedBooks` doc comment. A note
   * whose generated-block markers are missing (see
   * GeneratedBlockMissingError) is skipped rather than aborting the
   * whole scan, consistent with this plugin's per-item failure
   * isolation elsewhere (e.g. KindleSyncService.syncOneBook). */
  async flagRemovedBooks(currentBookIds: Set<string>): Promise<number> {
    let flaggedCount = 0;

    for (const note of this.findAllManagedNotes()) {
      if (currentBookIds.has(note.bookId)) {
        continue;
      }
      const cache = this.metadataCache.getFileCache(note.file);
      if (cache?.frontmatter?.[FRONTMATTER_MISSING_KEY] === true) {
        continue;
      }

      try {
        await this.vault.process(note.file, (data) =>
          insertMissingFromLibraryBanner(data, note.file.path),
        );
      } catch {
        continue;
      }
      await this.fileManager.processFrontMatter(note.file, (fm: Record<string, unknown>) => {
        fm[FRONTMATTER_MISSING_KEY] = true;
      });
      flaggedCount++;
    }

    return flaggedCount;
  }

  getLastSyncedAt(bookId: string): string | undefined {
    const existing = this.findExistingNote(bookId);
    if (!existing) {
      return undefined;
    }
    const value: unknown = this.metadataCache.getFileCache(existing)?.frontmatter?.[
      FRONTMATTER_LAST_SYNCED_AT_KEY
    ];
    return typeof value === "string" ? value : undefined;
  }

  private findExistingNote(bookId: string): TFile | undefined {
    return this.findAllManagedNotes().find((note) => note.bookId === bookId)?.file;
  }

  /** Every Markdown file under the output folder with a `kindle_book_id`
   * frontmatter value - the shared enumeration `findExistingNote()` and
   * `flagRemovedBooks()` both build on. */
  private findAllManagedNotes(): Array<{ file: TFile; bookId: string }> {
    const folderPrefix = `${joinVaultPath(this.outputFolder)}/`;
    const notes: Array<{ file: TFile; bookId: string }> = [];
    for (const file of this.vault.getMarkdownFiles()) {
      if (!file.path.startsWith(folderPrefix)) {
        continue;
      }
      const cache = this.metadataCache.getFileCache(file);
      const rawBookId: unknown = cache?.frontmatter?.[FRONTMATTER_BOOK_ID_KEY];
      if (typeof rawBookId === "string" && rawBookId.length > 0) {
        notes.push({ file, bookId: rawBookId });
      }
    }
    return notes;
  }

  private async createNote(
    book: KindleBook,
    initialBody: string,
    frontmatter: Record<string, unknown>,
  ): Promise<void> {
    const path = this.resolveCreatePath(book);
    let file: TFile;
    try {
      file = await this.vault.create(path, initialBody);
    } catch {
      throw new MarkdownSaveError(path);
    }
    await this.applyFrontmatter(file, frontmatter);
  }

  private async updateNote(
    file: TFile,
    frontmatter: Record<string, unknown>,
    generatedBlockBody: string,
  ): Promise<void> {
    try {
      await this.vault.process(file, (data) =>
        replaceGeneratedBlock(data, file.path, generatedBlockBody),
      );
    } catch (error) {
      if (error instanceof GeneratedBlockMissingError) {
        throw error;
      }
      throw new MarkdownSaveError(file.path);
    }
    await this.applyFrontmatter(file, frontmatter);
  }

  /** Shared by createNote()/updateNote(): merges the plugin-owned keys
   * and deletes the legacy `memo_count` key, if present, so a renamed
   * note doesn't end up with both `memo_count` and `note_count`. */
  private async applyFrontmatter(
    file: TFile,
    frontmatter: Record<string, unknown>,
  ): Promise<void> {
    await this.fileManager.processFrontMatter(file, (fm: Record<string, unknown>) => {
      delete fm[LEGACY_MEMO_COUNT_FRONTMATTER_KEY];
      Object.assign(fm, frontmatter);
    });
  }

  private resolveCreatePath(book: KindleBook): string {
    const plainPath = joinVaultPath(this.outputFolder, buildBookFileName(book.title));
    if (!this.vault.getAbstractFileByPath(plainPath)) {
      return plainPath;
    }
    const disambiguator = book.asin ?? book.id;
    return joinVaultPath(this.outputFolder, buildBookFileName(book.title, disambiguator));
  }

  private async ensureOutputFolderExists(): Promise<void> {
    const segments = joinVaultPath(this.outputFolder).split("/");

    let currentPath = "";
    for (const segment of segments) {
      currentPath = currentPath ? `${currentPath}/${segment}` : segment;
      const node = this.vault.getAbstractFileByPath(currentPath);
      if (isFolder(node)) {
        continue;
      }
      if (node) {
        throw new VaultFolderCreationError(currentPath);
      }
      try {
        await this.vault.createFolder(currentPath);
      } catch {
        const recheck = this.vault.getAbstractFileByPath(currentPath);
        if (!isFolder(recheck)) {
          throw new VaultFolderCreationError(currentPath);
        }
      }
    }
  }
}

/**
 * Duck-typed folder check (rather than `instanceof TFolder`) so this
 * module never needs a runtime value from the `obsidian` package, which
 * ships types only - see docs/architecture.md and utils/vaultPath.ts.
 */
function isFolder(node: TAbstractFile | null): node is TFolder {
  return node !== null && Array.isArray((node as Partial<TFolder>).children);
}

function replaceGeneratedBlock(data: string, path: string, generatedBlockBody: string): string {
  const startIndex = data.indexOf(GENERATED_BLOCK_START);
  const endIndex = data.indexOf(GENERATED_BLOCK_END);
  if (startIndex === -1 || endIndex === -1 || endIndex < startIndex) {
    throw new GeneratedBlockMissingError(path);
  }
  const before = data.slice(0, startIndex + GENERATED_BLOCK_START.length);
  const after = data.slice(endIndex);
  return `${before}\n\n${generatedBlockBody}\n\n${after}`;
}

/** Inserts the "missing from library" banner right after
 * GENERATED_BLOCK_START, leaving the rest of the block (existing
 * highlights) untouched - unlike replaceGeneratedBlock(), this never
 * discards content, since flagRemovedBooks() has no fresh fetch to
 * replace it with. */
function insertMissingFromLibraryBanner(data: string, path: string): string {
  const startIndex = data.indexOf(GENERATED_BLOCK_START);
  if (startIndex === -1) {
    throw new GeneratedBlockMissingError(path);
  }
  const insertAt = startIndex + GENERATED_BLOCK_START.length;
  return `${data.slice(0, insertAt)}\n\n${MISSING_FROM_LIBRARY_BANNER}\n${data.slice(insertAt)}`;
}
