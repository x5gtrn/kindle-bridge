/** Parse an HTML string with the runtime `DOMParser` (Electron/Obsidian
 * in production; a test polyfill under Vitest). Avoids bundling cheerio,
 * which pulled in runtime base64 encode/decode helpers the release
 * scanner flags. */
export function parseHtmlDocument(html: string): Document {
  return new DOMParser().parseFromString(html, "text/html");
}

export function elementText(element: Element | null): string {
  return element?.textContent?.trim() ?? "";
}

export function elementAttr(element: Element | null, name: string): string | undefined {
  const value = element?.getAttribute(name);
  return value != null && value.length > 0 ? value : undefined;
}
