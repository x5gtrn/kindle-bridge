import type { KindleBook } from "../models/KindleBook";
import type { AmazonRegion } from "./AmazonRegion";
import { KindleParseError } from "./KindleParseError";

/**
 * Pure function: HTML string in, KindleBook[] out. No network, no
 * Electron, no Obsidian API - unit tested against static HTML fixtures.
 * Real selector logic and fixtures land in Phase 2.
 */
export function parseBookList(html: string, region: AmazonRegion): KindleBook[] {
  if (html.trim().length === 0) {
    throw new KindleParseError("received empty notebook page HTML");
  }
  throw new KindleParseError(
    `book list parsing for region "${region.id}" is not implemented yet (planned for Phase 2).`,
  );
}
