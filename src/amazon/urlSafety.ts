/** Origin-only view of a URL, safe to log - never logs query strings or
 * fragments, which on Amazon's domains can carry session-ish tokens. */
export function safeUrlOrigin(url: string): string {
  try {
    return new URL(url).origin;
  } catch {
    return "[unparseable url]";
  }
}
