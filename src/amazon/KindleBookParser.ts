import * as cheerio from "cheerio";
import type { KindleBook } from "../models/KindleBook";
import { normalizeForHash, sha256Hex } from "../utils/hash";
import type { AmazonRegion } from "./AmazonRegion";
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

  const $ = cheerio.load(html);

  if ($(LIBRARY_CONTAINER_SELECTOR).length === 0) {
    throw new KindleParseError(
      `could not find the notebook library container ("${LIBRARY_CONTAINER_SELECTOR}") for region "${region.id}"`,
    );
  }

  const books: KindleBook[] = [];

  $(BOOK_SELECTOR).each((_index, element) => {
    const bookEl = $(element);
    const asin = bookEl.attr("data-asin") ?? bookEl.attr("id");
    const title = bookEl.find("h2.kp-notebook-searchable").first().text().trim();

    if (!title) {
      return;
    }

    const authorRaw = bookEl.find("p .kp-notebook-searchable").first().text().trim();
    const author = authorRaw.replace(AUTHOR_PREFIX_PATTERN, "").trim();

    const coverImageUrl = bookEl.find("img.kp-notebook-cover-image").attr("src");

    const annotatedDateSelector = asin ? `#kp-notebook-annotated-date-${asin}` : undefined;
    const annotatedDateRaw = annotatedDateSelector
      ? bookEl.find(annotatedDateSelector).attr("value")
      : undefined;
    const lastAnnotatedAt = parseAmazonDate(annotatedDateRaw, region);

    books.push({
      id: asin ?? `book-${sha256Hex(normalizeForHash(title)).slice(0, 16)}`,
      asin,
      title,
      authors: author.length > 0 ? [author] : [],
      coverImageUrl: coverImageUrl && coverImageUrl.length > 0 ? coverImageUrl : undefined,
      amazonUrl: asin ? `https://www.${region.amazonDomain}/dp/${asin}` : undefined,
      lastAnnotatedAt,
      region: region.id,
    });
  });

  return books;
}
