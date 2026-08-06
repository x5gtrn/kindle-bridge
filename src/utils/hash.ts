import { createHash } from "node:crypto";

/** Deterministic SHA-256 hex digest of a string. Pure and reproducible. */
export function sha256Hex(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

/**
 * Collapses whitespace so that cosmetic differences (line wrapping,
 * trailing spaces) don't change a content hash or annotation id.
 */
export function normalizeForHash(text: string): string {
  return text.trim().replace(/\s+/g, " ");
}
