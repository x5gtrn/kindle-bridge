import * as cheerio from "cheerio";
import type { AnnotationType, KindleAnnotation } from "../models/KindleAnnotation";
import { normalizeForHash, sha256Hex } from "../utils/hash";
import type { AmazonRegion } from "./AmazonRegion";
import { KindleParseError } from "./KindleParseError";

const ANNOTATIONS_CONTAINER_SELECTOR = "#kp-notebook-annotations";
/**
 * Confirmed against a real, live account on 2026-08-07 (see
 * docs/risks.md R-02): Amazon no longer marks up an individual
 * annotation with a semantic `.kp-notebook-annotation` class - each is
 * a `div` with a generated `id` and Amazon's generic layout classes
 * `a-row a-spacing-base`, as a direct child of `#kp-notebook-annotations`
 * alongside two unrelated hidden `<input>`s (pagination state) and an
 * `#empty-annotations-pane` shown only when the book has none. The `>`
 * (direct child) and compound class match are both load-bearing here:
 * `a-row`/`a-spacing-base` alone are generic Amazon utility classes used
 * all over the page, so an unscoped match would false-positive - notably
 * for CdpPage.waitForSelector(), which resolves on the *first* DOM match
 * anywhere on the page, not just within this container.
 */
export const ANNOTATION_SELECTOR = "#kp-notebook-annotations > div.a-row.a-spacing-base";

/**
 * Pure function: HTML string + owning book id in, KindleAnnotation[]
 * out. No network, no Electron, no Obsidian API - unit tested against
 * static HTML fixtures in src/tests/fixtures. Also owns deterministic
 * annotation id / content hash generation (docs/architecture.md §6):
 * Amazon exposes no stable per-annotation id in the scraped HTML, so
 * `id` is derived from region + book + type + location + text (see
 * below re: date), while `contentHash` covers only the mutable
 * text/memo content so a future differential sync (Phase 4+) can
 * distinguish "moved" from "edited". Selectors are best-effort per
 * docs/risks.md R-02.
 *
 * `page` and `createdAt` are always left `undefined` (both are already
 * optional on `KindleAnnotation` - see R-10): as of the 2026-08-07
 * confirmation above, the live page exposes neither a page number nor a
 * per-annotation date anywhere in an individual annotation's markup -
 * only `Location: N` remains as a hidden `<input>` value. If Amazon
 * reintroduces either, only this file needs to change.
 */
export function parseAnnotations(
  html: string,
  bookId: string,
  region: AmazonRegion,
): KindleAnnotation[] {
  if (html.trim().length === 0) {
    throw new KindleParseError("received empty annotations page HTML");
  }

  const $ = cheerio.load(html);

  if ($(ANNOTATIONS_CONTAINER_SELECTOR).length === 0) {
    throw new KindleParseError(
      `could not find the annotations container ("${ANNOTATIONS_CONTAINER_SELECTOR}") for book "${bookId}" in region "${region.id}"`,
    );
  }

  const annotations: KindleAnnotation[] = [];

  $(ANNOTATION_SELECTOR).each((_index, element) => {
    const el = $(element);

    const highlightText = el.find("#highlight").first().text().trim();
    const memoTextRaw = el.find("#note").first().text().trim();
    const memo = memoTextRaw.length > 0 ? memoTextRaw : undefined;

    // Amazon's UI can't produce a note without an underlying highlight,
    // but defensively drop any block with neither so a stray/empty row
    // never becomes a phantom annotation.
    if (highlightText.length === 0 && !memo) {
      return;
    }

    const type: AnnotationType = highlightText.length > 0 ? "highlight" : "memo";
    const text = highlightText.length > 0 ? highlightText : (memo ?? "");

    const location = firstNonEmpty(el.find("#kp-annotation-location").attr("value"));

    const id = sha256Hex(
      [region.id, bookId, type, location ?? "", normalizeForHash(text)].join("|"),
    );
    const contentHash = sha256Hex([normalizeForHash(text), normalizeForHash(memo ?? "")].join("|"));

    annotations.push({
      id,
      bookId,
      type,
      text,
      memo: type === "highlight" ? memo : undefined,
      location,
      sourceUrl: location
        ? `${region.kindleReaderUrl}/notebook?asin=${bookId}&location=${location}`
        : `${region.kindleReaderUrl}/notebook?asin=${bookId}`,
      contentHash,
    });
  });

  return annotations;
}

function firstNonEmpty(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
}
