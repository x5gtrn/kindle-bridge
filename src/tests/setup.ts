import { parseHTML } from "linkedom";

/**
 * Production timer calls use `window.setTimeout` / `window.clearTimeout`
 * for Obsidian popout-window compatibility. Vitest's node environment
 * has no `window`, so point it at the same global the tests already run
 * against.
 */
Object.defineProperty(globalThis, "window", {
  value: globalThis,
  configurable: true,
  writable: true,
});

/** HTML parsers use `DOMParser` (available in Obsidian's renderer). */
class TestDOMParser {
  parseFromString(markup: string, _type: string): Document {
    return parseHTML(markup).document as unknown as Document;
  }
}

Object.defineProperty(globalThis, "DOMParser", {
  value: TestDOMParser,
  configurable: true,
  writable: true,
});
