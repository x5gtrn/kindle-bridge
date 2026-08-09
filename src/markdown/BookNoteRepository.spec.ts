import type { FileManager, MetadataCache, TFile, Vault } from "obsidian";
import { beforeEach, describe, expect, it } from "vitest";
import type { KindleAnnotation } from "../models/KindleAnnotation";
import type { KindleBook } from "../models/KindleBook";
import {
  BookNoteRepository,
  GeneratedBlockMissingError,
  VaultFolderCreationError,
} from "./BookNoteRepository";
import { GENERATED_BLOCK_END, GENERATED_BLOCK_START } from "./BookNoteRenderer";

interface FakeNode {
  path: string;
  content: string;
  frontmatter: Record<string, unknown>;
}

class FakeVault {
  files = new Map<string, FakeNode>();
  folders = new Set<string>();

  getName(): string {
    return "TestVault";
  }

  getMarkdownFiles(): TFile[] {
    return [...this.files.values()].map((f) => ({ path: f.path }) as TFile);
  }

  getAbstractFileByPath(path: string) {
    if (this.folders.has(path)) {
      return { path, children: [] };
    }
    const file = this.files.get(path);
    return file ? { path: file.path, children: undefined } : null;
  }

  create(path: string, data: string): Promise<TFile> {
    if (this.files.has(path) || this.folders.has(path)) {
      return Promise.reject(new Error(`already exists: ${path}`));
    }
    this.files.set(path, { path, content: data, frontmatter: {} });
    return Promise.resolve({ path } as TFile);
  }

  process(file: TFile, fn: (data: string) => string): Promise<string> {
    const existing = this.files.get(file.path);
    if (!existing) {
      return Promise.reject(new Error(`not found: ${file.path}`));
    }
    existing.content = fn(existing.content);
    return Promise.resolve(existing.content);
  }

  createFolder(path: string): Promise<unknown> {
    this.folders.add(path);
    return Promise.resolve({ path, children: [] });
  }
}

class FakeMetadataCache {
  constructor(private readonly vault: FakeVault) {}

  getFileCache(file: TFile) {
    const existing = this.vault.files.get(file.path);
    if (!existing) {
      return null;
    }
    return { frontmatter: existing.frontmatter };
  }
}

class FakeFileManager {
  constructor(private readonly vault: FakeVault) {}

  processFrontMatter(file: TFile, fn: (fm: Record<string, unknown>) => void): Promise<void> {
    const existing = this.vault.files.get(file.path);
    if (!existing) {
      return Promise.reject(new Error(`not found: ${file.path}`));
    }
    fn(existing.frontmatter);
    return Promise.resolve();
  }
}

const book: KindleBook = {
  id: "B012345678",
  asin: "B012345678",
  title: "Book Title",
  authors: ["Author Name"],
  amazonUrl: "https://www.amazon.co.jp/dp/B012345678",
  region: "jp",
};

const annotation: KindleAnnotation = {
  id: "annotation-1",
  bookId: book.id,
  type: "highlight",
  text: "Highlight text",
  sourceUrl: "https://example.com/",
  contentHash: "hash-1",
};

const renderOptions = { displayCoverImage: true, syncedAt: "2026-08-06T18:00:00+09:00" };
const OUTPUT_FOLDER = "Highlight and Note/Books";

function buildRepository(vault: FakeVault) {
  return new BookNoteRepository(
    vault as unknown as Vault,
    new FakeMetadataCache(vault) as unknown as MetadataCache,
    new FakeFileManager(vault) as unknown as FileManager,
    OUTPUT_FOLDER,
  );
}

describe("BookNoteRepository", () => {
  let vault: FakeVault;

  beforeEach(() => {
    vault = new FakeVault();
  });

  it("creates the output folder (including nested segments) if missing", async () => {
    const repo = buildRepository(vault);
    await repo.upsert(book, [annotation], renderOptions);
    expect(vault.folders.has("Highlight and Note")).toBe(true);
    expect(vault.folders.has("Highlight and Note/Books")).toBe(true);
  });

  it("does not fail when the output folder already exists", async () => {
    vault.folders.add("Highlight and Note");
    vault.folders.add("Highlight and Note/Books");
    const repo = buildRepository(vault);
    await expect(repo.upsert(book, [annotation], renderOptions)).resolves.toBe("created");
  });

  it("throws VaultFolderCreationError when a path segment is a file, not a folder", async () => {
    vault.files.set("Highlight and Note", {
      path: "Highlight and Note",
      content: "",
      frontmatter: {},
    });
    const repo = buildRepository(vault);
    await expect(repo.upsert(book, [annotation], renderOptions)).rejects.toThrow(
      VaultFolderCreationError,
    );
  });

  it("creates a new note with frontmatter and a generated block", async () => {
    const repo = buildRepository(vault);
    const outcome = await repo.upsert(book, [annotation], renderOptions);
    expect(outcome).toBe("created");

    const file = vault.files.get("Highlight and Note/Books/Book Title.md");
    expect(file).toBeDefined();
    expect(file?.frontmatter.kindle_book_id).toBe(book.id);
    expect(file?.frontmatter.title).toBe(book.title);
    expect(file?.content).toContain(GENERATED_BLOCK_START);
    expect(file?.content).toContain(GENERATED_BLOCK_END);
    expect(file?.content).toContain("## My Notes");
  });

  it("disambiguates the file name when an unrelated file already occupies the plain path", async () => {
    vault.files.set("Highlight and Note/Books/Book Title.md", {
      path: "Highlight and Note/Books/Book Title.md",
      content: "unrelated note",
      frontmatter: {},
    });
    const repo = buildRepository(vault);
    await repo.upsert(book, [annotation], renderOptions);

    expect(vault.files.has(`Highlight and Note/Books/Book Title - ${book.asin}.md`)).toBe(true);
    expect(vault.files.get("Highlight and Note/Books/Book Title.md")?.content).toBe(
      "unrelated note",
    );
  });

  it("finds an existing note by frontmatter kindle_book_id, not by file name", async () => {
    const renamedPath = "Highlight and Note/Books/Renamed By User.md";
    vault.files.set(renamedPath, {
      path: renamedPath,
      content: `# Renamed\n\n${GENERATED_BLOCK_START}\n\nold content\n\n${GENERATED_BLOCK_END}\n\n## My Notes\n`,
      frontmatter: { kindle_book_id: book.id },
    });

    const repo = buildRepository(vault);
    const outcome = await repo.upsert(book, [annotation], renderOptions);

    expect(outcome).toBe("updated");
    expect(vault.files.has("Highlight and Note/Books/Book Title.md")).toBe(false);
    expect(vault.files.get(renamedPath)?.content).toContain(annotation.text);
  });

  it("preserves user content outside the generated block on update", async () => {
    const path = "Highlight and Note/Books/Book Title.md";
    vault.files.set(path, {
      path,
      content: [
        "# Book Title",
        "",
        "Some intro the user wrote.",
        "",
        GENERATED_BLOCK_START,
        "",
        "stale generated content",
        "",
        GENERATED_BLOCK_END,
        "",
        "## My Notes",
        "",
        "My own thoughts that must survive.",
      ].join("\n"),
      frontmatter: { kindle_book_id: book.id, custom_user_field: "keep me" },
    });

    const repo = buildRepository(vault);
    await repo.upsert(book, [annotation], renderOptions);

    const updated = vault.files.get(path);
    expect(updated?.content).toContain("Some intro the user wrote.");
    expect(updated?.content).toContain("My own thoughts that must survive.");
    expect(updated?.content).not.toContain("stale generated content");
    expect(updated?.content).toContain(annotation.text);
    expect(updated?.frontmatter.custom_user_field).toBe("keep me");
    expect(updated?.frontmatter.kindle_book_id).toBe(book.id);
  });

  it("updates only the plugin-owned frontmatter keys, preserving other keys", async () => {
    const path = "Highlight and Note/Books/Book Title.md";
    vault.files.set(path, {
      path,
      content: `# Book Title\n\n${GENERATED_BLOCK_START}\n\nold\n\n${GENERATED_BLOCK_END}\n\n## My Notes\n`,
      frontmatter: { kindle_book_id: book.id, title: "Stale Title", my_rating: 5 },
    });

    const repo = buildRepository(vault);
    await repo.upsert(book, [annotation], renderOptions);

    const updated = vault.files.get(path);
    expect(updated?.frontmatter.my_rating).toBe(5);
    expect(updated?.frontmatter.title).toBe(book.title);
  });

  it("deletes the legacy memo_count key on update, replacing it with note_count ('Memo' renamed to 'Note', 2026-08-10)", async () => {
    const path = "Highlight and Note/Books/Book Title.md";
    vault.files.set(path, {
      path,
      content: `# Book Title\n\n${GENERATED_BLOCK_START}\n\nold\n\n${GENERATED_BLOCK_END}\n\n## My Notes\n`,
      frontmatter: { kindle_book_id: book.id, memo_count: 3 },
    });

    const repo = buildRepository(vault);
    await repo.upsert(book, [annotation], renderOptions);

    const updated = vault.files.get(path);
    expect(updated?.frontmatter.memo_count).toBeUndefined();
    expect(updated?.frontmatter.note_count).toBe(0);
  });

  it("throws GeneratedBlockMissingError and leaves the file untouched if markers were removed", async () => {
    const path = "Highlight and Note/Books/Book Title.md";
    const originalContent = "# Book Title\n\nNo markers here anymore.\n\n## My Notes\n";
    vault.files.set(path, {
      path,
      content: originalContent,
      frontmatter: { kindle_book_id: book.id },
    });

    const repo = buildRepository(vault);
    await expect(repo.upsert(book, [annotation], renderOptions)).rejects.toThrow(
      GeneratedBlockMissingError,
    );
    expect(vault.files.get(path)?.content).toBe(originalContent);
  });

  it("throws GeneratedBlockMissingError when only the start marker survived (end marker deleted)", async () => {
    const path = "Highlight and Note/Books/Book Title.md";
    const originalContent = `# Book Title\n\n${GENERATED_BLOCK_START}\n\nold content, no end marker\n\n## My Notes\n`;
    vault.files.set(path, {
      path,
      content: originalContent,
      frontmatter: { kindle_book_id: book.id },
    });

    const repo = buildRepository(vault);
    await expect(repo.upsert(book, [annotation], renderOptions)).rejects.toThrow(
      GeneratedBlockMissingError,
    );
    expect(vault.files.get(path)?.content).toBe(originalContent);
  });

  it("throws GeneratedBlockMissingError when only the end marker survived (start marker deleted)", async () => {
    const path = "Highlight and Note/Books/Book Title.md";
    const originalContent = `# Book Title\n\nno start marker\n\nold content\n\n${GENERATED_BLOCK_END}\n\n## My Notes\n`;
    vault.files.set(path, {
      path,
      content: originalContent,
      frontmatter: { kindle_book_id: book.id },
    });

    const repo = buildRepository(vault);
    await expect(repo.upsert(book, [annotation], renderOptions)).rejects.toThrow(
      GeneratedBlockMissingError,
    );
    expect(vault.files.get(path)?.content).toBe(originalContent);
  });

  it("throws GeneratedBlockMissingError when the markers survived but in reversed order", async () => {
    const path = "Highlight and Note/Books/Book Title.md";
    // A user could plausibly reorder content by hand; end-before-start
    // must never be treated as a valid (empty) region to overwrite.
    const originalContent = `# Book Title\n\n${GENERATED_BLOCK_END}\n\nswapped\n\n${GENERATED_BLOCK_START}\n\n## My Notes\n`;
    vault.files.set(path, {
      path,
      content: originalContent,
      frontmatter: { kindle_book_id: book.id },
    });

    const repo = buildRepository(vault);
    await expect(repo.upsert(book, [annotation], renderOptions)).rejects.toThrow(
      GeneratedBlockMissingError,
    );
    expect(vault.files.get(path)?.content).toBe(originalContent);
  });

  it("saves a book note when the title contains characters illegal in file names", async () => {
    const illegalTitleBook: KindleBook = {
      ...book,
      title: 'Who: What? "Why" <This/That>|Really*',
    };
    const repo = buildRepository(vault);
    const outcome = await repo.upsert(illegalTitleBook, [annotation], renderOptions);

    expect(outcome).toBe("created");
    const savedPaths = [...vault.files.keys()];
    expect(savedPaths).toHaveLength(1);
    const savedPath = savedPaths[0];
    expect(savedPath).toBeDefined();
    // No character illegal in file names survives into the saved path.
    expect(savedPath).not.toMatch(/[\\:*?"<>|]/);
    expect(vault.files.get(savedPath ?? "")?.frontmatter.title).toBe(illegalTitleBook.title);
  });

  describe("zero-annotation books (docs/risks.md R-13)", () => {
    it("skips a book with no existing note and zero current annotations - no clutter note is created", async () => {
      const repo = buildRepository(vault);
      const outcome = await repo.upsert(book, [], renderOptions);

      expect(outcome).toBe("skipped");
      expect(vault.files.size).toBe(0);
    });

    it("clears an existing note's generated block to a placeholder when its annotations drop to zero", async () => {
      const path = "Highlight and Note/Books/Book Title.md";
      vault.files.set(path, {
        path,
        content: `# Book Title\n\n${GENERATED_BLOCK_START}\n\n${annotation.text}\n\n${GENERATED_BLOCK_END}\n\n## My Notes\n`,
        frontmatter: { kindle_book_id: book.id },
      });

      const repo = buildRepository(vault);
      const outcome = await repo.upsert(book, [], renderOptions);

      expect(outcome).toBe("updated");
      const updated = vault.files.get(path);
      expect(updated?.content).not.toContain(annotation.text);
      expect(updated?.content).toContain("No highlights or notes found");
    });
  });

  describe("flagRemovedBooks (docs/risks.md R-13)", () => {
    const otherBook: KindleBook = { ...book, id: "B0OTHERBOOK", asin: "B0OTHERBOOK" };

    it("flags a managed note whose book id is missing from the current set, without touching its content", async () => {
      const repo = buildRepository(vault);
      await repo.upsert(book, [annotation], renderOptions);
      const path = "Highlight and Note/Books/Book Title.md";

      const flaggedCount = await repo.flagRemovedBooks(new Set([otherBook.id]));

      expect(flaggedCount).toBe(1);
      const flagged = vault.files.get(path);
      expect(flagged?.frontmatter.kindle_bridge_missing_from_library).toBe(true);
      expect(flagged?.content).toContain("no longer appears in your Kindle library");
      expect(flagged?.content).toContain(annotation.text);
    });

    it("does not re-flag (or re-count) a note that's already flagged", async () => {
      const repo = buildRepository(vault);
      await repo.upsert(book, [annotation], renderOptions);
      await repo.flagRemovedBooks(new Set([otherBook.id]));

      const secondCount = await repo.flagRemovedBooks(new Set([otherBook.id]));

      expect(secondCount).toBe(0);
      const path = "Highlight and Note/Books/Book Title.md";
      const content = vault.files.get(path)?.content ?? "";
      // The banner text appears exactly once, not duplicated.
      expect(content.split("no longer appears in your Kindle library")).toHaveLength(2);
    });

    it("self-heals: a normal upsert for a previously-flagged book clears the flag and the banner", async () => {
      const repo = buildRepository(vault);
      await repo.upsert(book, [annotation], renderOptions);
      await repo.flagRemovedBooks(new Set([otherBook.id]));

      await repo.upsert(book, [annotation], renderOptions);

      const path = "Highlight and Note/Books/Book Title.md";
      const healed = vault.files.get(path);
      expect(healed?.frontmatter.kindle_bridge_missing_from_library).toBe(false);
      expect(healed?.content).not.toContain("no longer appears in your Kindle library");
    });

    it("does not flag a note whose book id is still in the current set", async () => {
      const repo = buildRepository(vault);
      await repo.upsert(book, [annotation], renderOptions);

      const flaggedCount = await repo.flagRemovedBooks(new Set([book.id]));

      expect(flaggedCount).toBe(0);
      const path = "Highlight and Note/Books/Book Title.md";
      // A normal upsert() already sets this explicitly to false (see
      // BookNoteRenderer.spec.ts) - it was never true to begin with.
      expect(vault.files.get(path)?.frontmatter.kindle_bridge_missing_from_library).toBe(false);
    });
  });

  describe("getLastSyncedAt", () => {
    it("returns undefined for a book with no existing note", () => {
      const repo = buildRepository(vault);
      expect(repo.getLastSyncedAt(book.id)).toBeUndefined();
    });

    it("returns the last_synced_at frontmatter value from an existing note", async () => {
      const repo = buildRepository(vault);
      await repo.upsert(book, [annotation], renderOptions);

      expect(repo.getLastSyncedAt(book.id)).toBe(renderOptions.syncedAt);
    });

    it("returns undefined when the frontmatter value isn't a string", () => {
      const path = "Highlight and Note/Books/Book Title.md";
      vault.files.set(path, {
        path,
        content: `# Book Title\n\n${GENERATED_BLOCK_START}\n\n${GENERATED_BLOCK_END}\n`,
        frontmatter: { kindle_book_id: book.id, last_synced_at: 12345 },
      });
      const repo = buildRepository(vault);

      expect(repo.getLastSyncedAt(book.id)).toBeUndefined();
    });
  });
});
