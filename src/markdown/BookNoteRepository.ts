import type { FileManager, MetadataCache, TAbstractFile, TFile, TFolder, Vault } from "obsidian";
import type { KindleAnnotation } from "../models/KindleAnnotation";
import type { KindleBook } from "../models/KindleBook";
import { joinVaultPath } from "../utils/vaultPath";
import { buildBookFileName } from "./FileNameSanitizer";
import {
  GENERATED_BLOCK_END,
  GENERATED_BLOCK_START,
  renderBookNote,
  type RenderBookNoteOptions,
} from "./BookNoteRenderer";

export type BookNoteWriteOutcome = "created" | "updated";

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
    await this.ensureOutputFolderExists();

    const rendered = renderBookNote(book, annotations, options);
    const existing = this.findExistingNote(book.id);

    if (existing) {
      await this.updateNote(existing, rendered.frontmatter, rendered.generatedBlockBody);
      return "updated";
    }

    await this.createNote(book, rendered.initialBody, rendered.frontmatter);
    return "created";
  }

  private findExistingNote(bookId: string): TFile | undefined {
    const folderPrefix = `${joinVaultPath(this.outputFolder)}/`;
    for (const file of this.vault.getMarkdownFiles()) {
      if (!file.path.startsWith(folderPrefix)) {
        continue;
      }
      const cache = this.metadataCache.getFileCache(file);
      const rawBookId: unknown = cache?.frontmatter?.[FRONTMATTER_BOOK_ID_KEY];
      if (typeof rawBookId === "string" && rawBookId === bookId) {
        return file;
      }
    }
    return undefined;
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
    await this.fileManager.processFrontMatter(file, (fm: Record<string, unknown>) => {
      Object.assign(fm, frontmatter);
    });
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
    await this.fileManager.processFrontMatter(file, (fm: Record<string, unknown>) => {
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
