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
