const DEFAULT_TARGET_SIZE = 500;

/**
 * Confirmed against a real, live account (2026-08-10): the cover image
 * URL Amazon embeds on the Kindle notebook page is pre-sized for its own
 * small list thumbnail via a `_SY<height>`/`_SX<width>` suffix (e.g.
 * `.../81W8knGT65L._SY160.jpg`, optionally wrapped with other modifiers
 * like `._AC_SY160_.jpg`) - Amazon serves the same underlying image at
 * any size on request by swapping that number, so this rewrites it to a
 * larger size rather than embedding Amazon's own tiny thumbnail. Leaves
 * the URL untouched if it doesn't match this shape (e.g. a test fixture,
 * or a future markup change) rather than guessing at a rewrite.
 */
const SIZE_SUFFIX_PATTERN = /(_S[XY])\d+(_?\.\w+)$/i;

export function upsizeCoverImageUrl(url: string, targetSize = DEFAULT_TARGET_SIZE): string {
  return url.replace(SIZE_SUFFIX_PATTERN, `$1${targetSize}$2`);
}
