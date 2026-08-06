import { NotImplementedYetError } from "../utils/errors";
import type { KindleAnnotation } from "../models/KindleAnnotation";
import type { KindleBook } from "../models/KindleBook";

/** Delimits the plugin-managed region of a book note. Content outside
 * these markers is user-owned and must never be touched by sync -
 * see docs/architecture.md §7. */
export const GENERATED_BLOCK_START = "<!-- kindle-bridge:generated:start -->";
export const GENERATED_BLOCK_END = "<!-- kindle-bridge:generated:end -->";

export interface RenderedBookNote {
  frontmatter: Record<string, unknown>;
  generatedBlockBody: string;
}

/**
 * Pure function: book + annotations in, generated-block content out.
 * Never touches the Vault or the rest of the note - BookNoteRepository
 * owns merging this into an actual file. Implemented in Phase 3.
 */
export function renderBookNote(
  _book: KindleBook,
  _annotations: KindleAnnotation[],
): RenderedBookNote {
  throw new NotImplementedYetError("Book note rendering", "Phase 3");
}
