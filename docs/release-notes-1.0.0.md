# Kindle Bridge 1.0.0

Initial release of Kindle Bridge, an Obsidian plugin that syncs your Kindle highlights and notes from Amazon into per-book Markdown notes in your vault.

## What it does

- Signs in to Amazon using Amazon's own official sign-in page, opened in a separate browser window. Kindle Bridge never sees or stores your password, one-time code, or cookies.
- Fetches your Kindle highlights and notes from Amazon's notebook pages and generates one Markdown note per book, with frontmatter (title, authors, ASIN, cover, counts, dates) and a clearly delimited, plugin-managed section — everything else in the note is yours.
- Skips books that haven't been annotated since their last sync, and reflects deletions on Amazon's side (removed highlights disappear; a book removed from your library is flagged, not deleted).
- Optional Daily Note summary line, optional startup/interval automatic sync, and optional cover image display — all off by default except cover image display.

## Supported regions

- **Japan** and **Global / United States** — verified against real accounts.
- United Kingdom, Germany, France, Spain, Italy, and Netherlands are selectable but unverified — see the README for details.

## Important limitations

- **Desktop only.** Not available on Obsidian Mobile.
- **Requires an installed Chrome, Edge, Chromium, or Brave browser** — sign-in and sync launch one of these as a separate process.
- Only the first page of a book's highlights/notes is fetched; very heavily annotated books beyond Amazon's per-page limit won't sync everything.
- No per-annotation page number or creation date — Amazon's current notebook page doesn't expose either.
- This plugin automates Amazon's own web pages, not an official API. Amazon can change its page structure or login flow at any time without notice, which can temporarily break sync until the plugin is updated.

## Privacy and security

- No analytics, no telemetry, no developer-owned server. The only network destination is Amazon.
- Your Amazon password, one-time code, and cookies are never read, stored, or logged by this plugin.
- Full details: [PRIVACY.md](../PRIVACY.md) and [SECURITY.md](../SECURITY.md).

## Installation

Once available in the Community Plugins directory: **Settings → Community plugins → Browse → Kindle Bridge → Install → Enable**.

For manual installation before or without the directory listing, see [README.md § Manual installation](../README.md#manual-installation).

## Known issues

- Regions beyond Japan and Global are unverified against real accounts.
- Automatic interval sync has not been specifically tested across system sleep/wake cycles.
- No line-level diff or change history for edited (as opposed to added/removed) highlights — the plugin-managed block is regenerated in full on each sync that touches a book.

## Disclaimer

Kindle Bridge is an independent community plugin and is not affiliated with, endorsed by, or sponsored by Amazon or Obsidian.
