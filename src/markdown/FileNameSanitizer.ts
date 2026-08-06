const ILLEGAL_FILENAME_CHARS = /[\\/:*?"<>|]/g;
const TRAILING_DOTS_OR_SPACES = /[. ]+$/;
const MAX_TITLE_LENGTH = 150;

/** Strips characters that are illegal (or awkward) in file names across OSes. */
export function sanitizeFileNameComponent(input: string): string {
  const cleaned = input
    .replace(ILLEGAL_FILENAME_CHARS, "-")
    .replace(/\s+/g, " ")
    .trim()
    .replace(TRAILING_DOTS_OR_SPACES, "")
    .slice(0, MAX_TITLE_LENGTH)
    .trim();
  return cleaned.length > 0 ? cleaned : "Untitled";
}

/**
 * Builds the Markdown file name for a book note. Pass `disambiguator`
 * (e.g. an ASIN or short book id) only when another book with the same
 * sanitized title already exists, per spec: "Book Title - B012345678.md".
 */
export function buildBookFileName(title: string, disambiguator?: string): string {
  const safeTitle = sanitizeFileNameComponent(title);
  const base = disambiguator
    ? `${safeTitle} - ${sanitizeFileNameComponent(disambiguator)}`
    : safeTitle;
  return `${base}.md`;
}
