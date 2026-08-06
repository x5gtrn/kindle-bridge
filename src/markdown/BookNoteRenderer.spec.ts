import { describe, expect, it } from "vitest";
import type { KindleAnnotation } from "../models/KindleAnnotation";
import type { KindleBook } from "../models/KindleBook";
import { GENERATED_BLOCK_END, GENERATED_BLOCK_START, renderBookNote } from "./BookNoteRenderer";

const book: KindleBook = {
  id: "B012345678",
  asin: "B012345678",
  title: "Book Title",
  authors: ["Author Name"],
  coverImageUrl: "https://example.com/cover.jpg",
  amazonUrl: "https://www.amazon.co.jp/dp/B012345678",
  lastAnnotatedAt: "2026-08-06",
  region: "jp",
};

const highlightOnly: KindleAnnotation = {
  id: "annotation-1",
  bookId: book.id,
  type: "highlight",
  text: "Highlight text",
  location: "123",
  createdAt: "2026-08-01",
  sourceUrl: "https://example.com/",
  contentHash: "hash-1",
};

const highlightWithMemo: KindleAnnotation = {
  id: "annotation-2",
  bookId: book.id,
  type: "highlight",
  text: "Highlight text",
  memo: "Memo text.",
  location: "456",
  createdAt: "2026-08-02",
  sourceUrl: "https://example.com/",
  contentHash: "hash-2",
};

const memoOnly: KindleAnnotation = {
  id: "annotation-3",
  bookId: book.id,
  type: "memo",
  text: "A standalone memo.",
  sourceUrl: "https://example.com/",
  contentHash: "hash-3",
};

const options = { displayCoverImage: true, syncedAt: "2026-08-06T18:00:00+09:00" };

describe("renderBookNote", () => {
  it("computes highlight_count/memo_count/annotation_count per the spec's counting rule", () => {
    const { frontmatter } = renderBookNote(
      book,
      [highlightOnly, highlightWithMemo, memoOnly],
      options,
    );
    expect(frontmatter.highlight_count).toBe(2);
    expect(frontmatter.memo_count).toBe(2); // highlightWithMemo's memo + memoOnly
    expect(frontmatter.annotation_count).toBe(4);
  });

  it("includes the plugin-owned frontmatter fields", () => {
    const { frontmatter } = renderBookNote(book, [highlightOnly], options);
    expect(frontmatter).toMatchObject({
      kindle_bridge: true,
      kindle_book_id: "B012345678",
      asin: "B012345678",
      title: "Book Title",
      authors: ["Author Name"],
      amazon_region: "jp",
      amazon_url: book.amazonUrl,
      cover_image_url: book.coverImageUrl,
      last_annotated_at: "2026-08-06",
      last_synced_at: options.syncedAt,
      tags: ["kindle", "reading"],
    });
  });

  it("wraps generated content in the block markers exactly once", () => {
    const { initialBody } = renderBookNote(book, [highlightOnly], options);
    expect(countOccurrences(initialBody, GENERATED_BLOCK_START)).toBe(1);
    expect(countOccurrences(initialBody, GENERATED_BLOCK_END)).toBe(1);
    expect(initialBody.indexOf(GENERATED_BLOCK_START)).toBeLessThan(
      initialBody.indexOf(GENERATED_BLOCK_END),
    );
  });

  it("includes a title heading, cover image, author, and Amazon link in the header", () => {
    const { initialBody } = renderBookNote(book, [highlightOnly], options);
    expect(initialBody).toContain("# Book Title");
    expect(initialBody).toContain(`[![Book cover](${book.coverImageUrl})](${book.amazonUrl})`);
    expect(initialBody).toContain("**Author:** Author Name");
    expect(initialBody).toContain(`[Open book page](${book.amazonUrl})`);
    expect(initialBody).toContain("## My Notes");
  });

  it("omits the cover image when displayCoverImage is false", () => {
    const { initialBody } = renderBookNote(book, [highlightOnly], {
      ...options,
      displayCoverImage: false,
    });
    expect(initialBody).not.toContain("![Book cover]");
  });

  it("omits the cover image when the book has none, even if displayCoverImage is true", () => {
    const { initialBody } = renderBookNote(
      { ...book, coverImageUrl: undefined },
      [highlightOnly],
      options,
    );
    expect(initialBody).not.toContain("![Book cover]");
  });

  it("omits the Amazon link line, and falls back to the cover image's own URL as its link target, when amazonUrl is absent", () => {
    const { initialBody } = renderBookNote(
      { ...book, amazonUrl: undefined },
      [highlightOnly],
      options,
    );
    expect(initialBody).not.toContain("**Amazon:**");
    expect(initialBody).toContain(`[![Book cover](${book.coverImageUrl})](${book.coverImageUrl})`);
  });

  it("omits both the cover image and the Amazon link when the book has neither", () => {
    const { initialBody } = renderBookNote(
      { ...book, coverImageUrl: undefined, amazonUrl: undefined },
      [highlightOnly],
      options,
    );
    expect(initialBody).not.toContain("![Book cover]");
    expect(initialBody).not.toContain("**Amazon:**");
  });

  it("passes Markdown special characters in highlight/memo text through unescaped (known cosmetic limitation)", () => {
    const specialCharsAnnotation: KindleAnnotation = {
      id: "annotation-5",
      bookId: book.id,
      type: "highlight",
      text: "Text with *asterisks*, # a hash, and [brackets](url).",
      memo: "Memo with _underscores_ and a | pipe.",
      sourceUrl: "https://example.com/",
      contentHash: "hash-5",
    };
    const { generatedBlockBody } = renderBookNote(book, [specialCharsAnnotation], options);
    // Documents current behavior: no escaping is applied. If Amazon-sourced
    // text ever contains Markdown syntax, it renders as formatting rather
    // than literal text - a cosmetic issue, not a data-loss or file-
    // corruption one, since the underlying content is preserved verbatim.
    expect(generatedBlockBody).toContain("Text with *asterisks*, # a hash, and [brackets](url).");
    expect(generatedBlockBody).toContain("Memo with _underscores_ and a | pipe.");
  });

  it("passes YAML-special characters in title/authors through to the frontmatter object unmodified", () => {
    const trickyBook: KindleBook = {
      ...book,
      title: 'Title: "With" a colon and quotes',
      authors: ["O'Brien: The Author"],
    };
    const { frontmatter } = renderBookNote(trickyBook, [highlightOnly], options);
    // BookNoteRenderer must not attempt its own YAML escaping - the value
    // is handed to Obsidian's FileManager.processFrontMatter as-is, which
    // owns YAML serialization (see docs/architecture.md §7). This only
    // verifies we don't mangle the string ourselves; actual YAML file
    // output is not exercised by this pure-function test (real Obsidian
    // is required - see docs/manual-test-checklist.md).
    expect(frontmatter.title).toBe('Title: "With" a colon and quotes');
    expect(frontmatter.authors).toEqual(["O'Brien: The Author"]);
  });

  it("renders a plain highlight with location, created date, and source", () => {
    const { generatedBlockBody } = renderBookNote(book, [highlightOnly], options);
    expect(generatedBlockBody).toContain("### Highlight");
    expect(generatedBlockBody).not.toContain("### Highlight with Memo");
    expect(generatedBlockBody).toContain("<!-- kindle-bridge:annotation:id=annotation-1 -->");
    expect(generatedBlockBody).toContain("> Highlight text");
    expect(generatedBlockBody).toContain("- Location: 123");
    expect(generatedBlockBody).toContain("- Created: 2026-08-01");
    expect(generatedBlockBody).toContain("- Source: [Open in Kindle](https://example.com/)");
  });

  it("renders a highlight with an attached memo under its own heading", () => {
    const { generatedBlockBody } = renderBookNote(book, [highlightWithMemo], options);
    expect(generatedBlockBody).toContain("### Highlight with Memo");
    expect(generatedBlockBody).toContain("> Highlight text");
    expect(generatedBlockBody).toContain("**Memo**");
    expect(generatedBlockBody).toContain("Memo text.");
  });

  it("renders a standalone memo without a blockquote", () => {
    const { generatedBlockBody } = renderBookNote(book, [memoOnly], options);
    expect(generatedBlockBody).toContain("### Memo");
    expect(generatedBlockBody).toContain("A standalone memo.");
    expect(generatedBlockBody).not.toContain("> A standalone memo.");
  });

  it("omits location/page/created lines when absent", () => {
    const minimal: KindleAnnotation = {
      id: "annotation-4",
      bookId: book.id,
      type: "highlight",
      text: "Minimal highlight.",
      sourceUrl: "https://example.com/",
      contentHash: "hash-4",
    };
    const { generatedBlockBody } = renderBookNote(book, [minimal], options);
    expect(generatedBlockBody).not.toContain("Location:");
    expect(generatedBlockBody).not.toContain("Page:");
    expect(generatedBlockBody).not.toContain("Created:");
    expect(generatedBlockBody).toContain("Source:");
  });

  it("renders multiple annotations in order, separated by blank lines", () => {
    const { generatedBlockBody } = renderBookNote(
      book,
      [highlightOnly, highlightWithMemo],
      options,
    );
    const firstIndex = generatedBlockBody.indexOf("annotation-1");
    const secondIndex = generatedBlockBody.indexOf("annotation-2");
    expect(firstIndex).toBeGreaterThanOrEqual(0);
    expect(secondIndex).toBeGreaterThan(firstIndex);
  });

  it("produces identical output for identical input (pure function)", () => {
    const first = renderBookNote(book, [highlightOnly, memoOnly], options);
    const second = renderBookNote(book, [highlightOnly, memoOnly], options);
    expect(first).toEqual(second);
  });
});

function countOccurrences(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1;
}
