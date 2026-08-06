import type { KindleAnnotation } from "../models/KindleAnnotation";
import type { AmazonRegion } from "./AmazonRegion";
import { KindleParseError } from "./KindleParseError";

/**
 * Pure function: HTML string + owning book id in, KindleAnnotation[] out.
 * Also owns deterministic annotation id / content hash generation so
 * re-parsing the same annotation is idempotent (docs/architecture.md §6).
 * Real selector logic and fixtures land in Phase 2.
 */
export function parseAnnotations(
  html: string,
  bookId: string,
  region: AmazonRegion,
): KindleAnnotation[] {
  if (html.trim().length === 0) {
    throw new KindleParseError("received empty annotations page HTML");
  }
  throw new KindleParseError(
    `annotation parsing for book "${bookId}" in region "${region.id}" is not implemented yet (planned for Phase 2).`,
  );
}
