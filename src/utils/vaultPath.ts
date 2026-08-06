/**
 * Joins vault-relative path segments with "/", collapsing duplicate
 * slashes and stripping blank segments. A minimal stand-in for
 * Obsidian's own `normalizePath()` that doesn't require the Obsidian
 * runtime (the `obsidian` npm package ships types only, no JS
 * implementation - see docs/architecture.md), so vault-path logic in
 * BookNoteRepository stays unit-testable without a full Obsidian mock.
 */
export function joinVaultPath(...segments: string[]): string {
  return segments
    .join("/")
    .split("/")
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .join("/");
}
