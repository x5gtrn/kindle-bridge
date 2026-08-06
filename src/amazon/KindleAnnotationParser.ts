import * as cheerio from "cheerio";
import type { AnnotationType, KindleAnnotation } from "../models/KindleAnnotation";
import { normalizeForHash, sha256Hex } from "../utils/hash";
import type { AmazonRegion } from "./AmazonRegion";
import { KindleParseError } from "./KindleParseError";
import { parseAmazonDate } from "./parseAmazonDate";

const ANNOTATIONS_CONTAINER_SELECTOR = "#kp-notebook-annotations";
const ANNOTATION_SELECTOR = ".kp-notebook-annotation";

/**
 * Pure function: HTML string + owning book id in, KindleAnnotation[]
 * out. No network, no Electron, no Obsidian API - unit tested against
 * static HTML fixtures in src/tests/fixtures. Also owns deterministic
 * annotation id / content hash generation (docs/architecture.md §6):
 * Amazon exposes no stable per-annotation id in the scraped HTML, so
 * `id` is derived from region + book + type + location + text + date,
 * while `contentHash` covers only the mutable text/memo content so a
 * future differential sync (Phase 4+) can distinguish "moved" from
 * "edited". Selectors are best-effort per docs/risks.md R-02.
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

    const highlightText = el.find(".kp-notebook-highlight-text").first().text().trim();
    const memoTextRaw = el.find(".kp-notebook-note-text").first().text().trim();
    const memo = memoTextRaw.length > 0 ? memoTextRaw : undefined;

    // Amazon's UI can't produce a note without an underlying highlight,
    // but defensively drop any block with neither so a stray/empty row
    // never becomes a phantom annotation.
    if (highlightText.length === 0 && !memo) {
      return;
    }

    const type: AnnotationType = highlightText.length > 0 ? "highlight" : "memo";
    const text = highlightText.length > 0 ? highlightText : (memo ?? "");

    const location = firstNonEmpty(el.find(".kp-annotation-location").attr("value"));
    const page = firstNonEmpty(el.find(".kp-annotation-page").attr("value"));
    const createdAt = parseAmazonDate(el.find(".kp-annotation-created").attr("value"), region);

    const id = sha256Hex(
      [region.id, bookId, type, location ?? "", normalizeForHash(text), createdAt ?? ""].join("|"),
    );
    const contentHash = sha256Hex([normalizeForHash(text), normalizeForHash(memo ?? "")].join("|"));

    annotations.push({
      id,
      bookId,
      type,
      text,
      memo: type === "highlight" ? memo : undefined,
      location,
      page,
      createdAt,
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
