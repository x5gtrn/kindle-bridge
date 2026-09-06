import type { KindleBook } from "../models/KindleBook";
import { normalizeForHash, sha256Hex } from "../utils/hash";
import { upsizeCoverImageUrl } from "./amazonImageUrl";
import type { AmazonRegion } from "./AmazonRegion";
import { elementAttr, elementText, parseHtmlDocument } from "./htmlDocument";
import { KindleParseError } from "./KindleParseError";
import { parseAmazonDate } from "./parseAmazonDate";

const LIBRARY_CONTAINER_SELECTOR = "#kp-notebook-library";
const BOOK_SELECTOR = ".kp-notebook-library-each-book";
const AUTHOR_PREFIX_PATTERN = /^(By:|著者[：:])\s*/;

/**
 * Pure function: HTML string in, KindleBook[] out. No network, no
 * Electron, no Obsidian API - unit tested against static HTML fixtures
 * in src/tests/fixtures. Selectors are documented in
 * docs/architecture.md §6; if Amazon's markup changes, only this file
 * (and its fixtures/tests) should need updating - see docs/risks.md R-02.
 */
export function parseBookList(html: string, region: AmazonRegion): KindleBook[] {
  if (html.trim().length === 0) {
    throw new KindleParseError("received empty notebook page HTML");
  }

  const document = parseHtmlDocument(html);

  if (!document.querySelector(LIBRARY_CONTAINER_SELECTOR)) {
    throw new KindleParseError(
      `could not find the notebook library container ("${LIBRARY_CONTAINER_SELECTOR}") for region "${region.id}"`,
    );
  }

  const books: KindleBook[] = [];

  for (const bookEl of Array.from(document.querySelectorAll(BOOK_SELECTOR))) {
    const asin = elementAttr(bookEl, "data-asin") ?? elementAttr(bookEl, "id");
    const title = elementText(bookEl.querySelector("h2.kp-notebook-searchable"));

    if (!title) {
      continue;
    }

    // Confirmed against a real, live account (2026-08-10, see
    // docs/risks.md R-02): the class is on the <p> element itself, not
    // a descendant of it - "p .kp-notebook-searchable" (a descendant
    // combinator) never matched anything, silently leaving every
    // book's authors empty. "p.kp-notebook-searchable" (a compound
    // selector, no space) is the same pattern the title selector above
    // already correctly used.
    const authorRaw = elementText(bookEl.querySelector("p.kp-notebook-searchable"));
    const author = authorRaw.replace(AUTHOR_PREFIX_PATTERN, "").trim();

    const coverImageUrl = elementAttr(bookEl.querySelector("img.kp-notebook-cover-image"), "src");

    const annotatedDateSelector = asin ? `#kp-notebook-annotated-date-${asin}` : undefined;
    const annotatedDateRaw = annotatedDateSelector
      ? elementAttr(bookEl.querySelector(annotatedDateSelector), "value")
      : undefined;
    const lastAnnotatedAt = parseAmazonDate(annotatedDateRaw, region);

    books.push({
      id: asin ?? `book-${sha256Hex(normalizeForHash(title)).slice(0, 16)}`,
      asin,
      title,
      authors: author.length > 0 ? [author] : [],
      coverImageUrl:
        coverImageUrl && coverImageUrl.length > 0 ? upsizeCoverImageUrl(coverImageUrl) : undefined,
      amazonUrl: asin ? `https://www.${region.amazonDomain}/dp/${asin}` : undefined,
      lastAnnotatedAt,
      region: region.id,
    });
  }

  return books;
}
