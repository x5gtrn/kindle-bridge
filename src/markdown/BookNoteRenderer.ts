import type { KindleAnnotation } from "../models/KindleAnnotation";
import type { KindleBook } from "../models/KindleBook";

/** Delimits the plugin-managed region of a book note. Content outside
 * these markers is user-owned and must never be touched by sync -
 * see docs/architecture.md §7. */
export const GENERATED_BLOCK_START = "<!-- kindle-bridge:generated:start -->";
export const GENERATED_BLOCK_END = "<!-- kindle-bridge:generated:end -->";

/** Shown instead of a blank block when a sync confirms zero current
 * annotations for a book that already has a note - distinguishes
 * "confirmed empty" from "something broke." See docs/risks.md R-13. */
const NO_ANNOTATIONS_PLACEHOLDER =
  "_No highlights or notes found for this book on Amazon as of the last sync._";

/** Prepended into the generated block (never replacing existing
 * content) for a note whose book no longer appears in the Kindle
 * library - see BookNoteRepository.flagRemovedBooks() and
 * docs/risks.md R-13. Self-healing: a normal sync fully regenerates
 * the block and this banner is not part of that regeneration, so it
 * disappears the next time the book is actually synced again. */
export const MISSING_FROM_LIBRARY_BANNER =
  "> [!warning] This book no longer appears in your Kindle library\n" +
  "> The highlights/notes below are from the last successful sync and won't be updated further unless this book reappears.";

export interface RenderedBookNote {
  /** Plugin-owned frontmatter keys, for a shallow merge into the file's
   * frontmatter (existing user-added keys are left untouched). */
  frontmatter: Record<string, unknown>;
  /** Full initial file body (header + generated block + footer), used
   * only when creating a brand-new note. */
  initialBody: string;
  /** Just the annotation listing, used to replace the text between
   * GENERATED_BLOCK_START/END on an update. */
  generatedBlockBody: string;
}

export interface RenderBookNoteOptions {
  displayCoverImage: boolean;
  /** ISO-8601 instant this sync ran, for `last_synced_at`. */
  syncedAt: string;
}

/**
 * Pure function: book + annotations in, rendered Markdown pieces out.
 * Never touches the Vault or reads/writes an actual file -
 * BookNoteRepository owns merging this into a note. See
 * docs/architecture.md §7 for the two-tier protection strategy this
 * output is designed for (frontmatter: merge known keys only; body:
 * replace only within the generated-block markers).
 */
export function renderBookNote(
  book: KindleBook,
  annotations: KindleAnnotation[],
  options: RenderBookNoteOptions,
): RenderedBookNote {
  const highlightCount = annotations.filter((a) => a.type === "highlight").length;
  const noteCount = annotations.filter((a) => a.type === "note" || a.note !== undefined).length;

  const frontmatter: Record<string, unknown> = {
    kindle_bridge: true,
    kindle_book_id: book.id,
    asin: book.asin ?? null,
    title: book.title,
    authors: book.authors,
    amazon_region: book.region,
    amazon_url: book.amazonUrl ?? null,
    cover_image_url: book.coverImageUrl ?? null,
    last_annotated_at: book.lastAnnotatedAt ?? null,
    annotation_count: highlightCount + noteCount,
    highlight_count: highlightCount,
    note_count: noteCount,
    last_synced_at: options.syncedAt,
    tags: ["kindle", "reading"],
    // Always explicitly reset (never omitted) so a normal sync
    // self-heals a note previously flagged by
    // BookNoteRepository.flagRemovedBooks() - see docs/risks.md R-13.
    kindle_bridge_missing_from_library: false,
  };

  const generatedBlockBody = renderAnnotations(annotations);
  const header = renderHeader(book, options.displayCoverImage);

  const initialBody = [
    header,
    "",
    GENERATED_BLOCK_START,
    "",
    generatedBlockBody,
    "",
    GENERATED_BLOCK_END,
    "",
    "## My Notes",
    "",
  ].join("\n");

  return { frontmatter, initialBody, generatedBlockBody };
}

function renderHeader(book: KindleBook, displayCoverImage: boolean): string {
  const lines: string[] = [`# ${book.title}`, ""];

  if (displayCoverImage && book.coverImageUrl) {
    const coverLink = book.amazonUrl ?? book.coverImageUrl;
    lines.push(`[![Book cover](${book.coverImageUrl})](${coverLink})`, "");
  }

  if (book.authors.length > 0) {
    lines.push(`**Author:** ${book.authors.join(", ")}  `);
  }
  if (book.amazonUrl) {
    lines.push(`**Amazon:** [Open book page](${book.amazonUrl})`);
  }
  lines.push("", "## Highlights and Notes");

  return lines.join("\n");
}

function renderAnnotations(annotations: KindleAnnotation[]): string {
  if (annotations.length === 0) {
    return NO_ANNOTATIONS_PLACEHOLDER;
  }
  return annotations.map((annotation) => renderAnnotation(annotation)).join("\n\n");
}

function renderAnnotation(annotation: KindleAnnotation): string {
  const heading =
    annotation.type === "note"
      ? "Note"
      : annotation.note !== undefined
        ? "Highlight with Note"
        : "Highlight";

  const lines: string[] = [
    `### ${heading}`,
    "",
    `<!-- kindle-bridge:annotation:id=${annotation.id} -->`,
    "",
  ];

  if (annotation.type === "highlight") {
    lines.push(toBlockquote(annotation.text));
    if (annotation.note !== undefined) {
      lines.push("", "**Note**", "", annotation.note);
    }
  } else {
    lines.push(annotation.text);
  }

  const metaLines: string[] = [];
  if (annotation.location) {
    metaLines.push(`- Location: ${annotation.location}`);
  }
  if (annotation.page) {
    metaLines.push(`- Page: ${annotation.page}`);
  }
  if (annotation.createdAt) {
    metaLines.push(`- Created: ${annotation.createdAt}`);
  }
  if (annotation.sourceUrl) {
    metaLines.push(`- Source: [Open in Kindle](${annotation.sourceUrl})`);
  }

  if (metaLines.length > 0) {
    lines.push("", ...metaLines);
  }

  return lines.join("\n");
}

function toBlockquote(text: string): string {
  return text
    .split("\n")
    .map((line) => `> ${line}`)
    .join("\n");
}
