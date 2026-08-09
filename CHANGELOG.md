# Changelog

All notable changes to Kindle Bridge are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/).

## [1.0.1] - 2026-08-10

### Fixed

- Fixed a false minimum-version dependency: the plugin's own `settings` field was renamed to `pluginSettings` after Obsidian 1.13.0 introduced an official, same-named `Plugin.settings` field. The name collision made static analysis treat this plugin as requiring Obsidian 1.13.0+, even though it has no actual dependency on that API — `minAppVersion` stays `1.4.4`.
- Removed the "kindle-bridge-" prefix from command IDs (Obsidian already namespaces commands by plugin ID, so the prefix was redundant).
- Removed a call to the deprecated `SliderComponent.setDynamicTooltip()` (Obsidian now always shows the slider tooltip inline).

### Changed

- Replaced the `builtin-modules` dependency with Node's built-in `node:module` `builtinModules` in the build config, removing an unnecessary dependency.
- Routed default (non-debug) console logging through `console.debug` instead of `console.log`, per Obsidian's console-logging guideline.
- Adopted the official [`eslint-plugin-obsidianmd`](https://github.com/obsidianmd/eslint-plugin) rule set in local linting and CI, to catch this class of issue automatically going forward.

## [1.0.0] - 2026-08-10

Initial public release.

### Added

- Sign in to Amazon via Amazon's own official sign-in page, opened in a separate Chrome/Edge/Chromium/Brave browser process driven over the Chrome DevTools Protocol. The plugin never sees or stores your password, one-time code, or cookies.
- Manual sync ("Sync now" command, ribbon icon, and settings-tab button) that fetches your Kindle book list and, for each book, its highlights and notes from Amazon's notebook pages.
- One generated Markdown note per book, with a frontmatter schema (`kindle_book_id`, `asin`, `title`, `authors`, `amazon_region`, `amazon_url`, `cover_image_url`, `last_annotated_at`, `annotation_count`, `highlight_count`, `note_count`, `last_synced_at`, `tags`, `kindle_bridge_missing_from_library`) and a clearly delimited, plugin-managed content block that never overwrites the rest of the note.
- Differential sync: a book is skipped if Amazon hasn't shown new annotation activity since its last sync.
- Deletion handling: highlights/notes removed on Amazon's side drop out of the note on the next sync; a book removed from your Kindle library is flagged with a non-destructive banner instead of being deleted, and the flag clears automatically if the book reappears.
- Optional Daily Note integration: appends a one-line sync summary to today's Daily Note, only if it already exists.
- Optional scheduled sync: sync once on Obsidian startup, and/or on a fixed interval (15–360 minutes) while Obsidian is open. Both off by default.
- Optional cover image display, linked to the book's Amazon page.
- Settings tab covering Amazon region, sign-in/status/sync controls, output folder, cover image display, debug logging, Daily Note integration, and scheduled sync.
- Support for the Japan and Global/United States Amazon regions, verified against real accounts. United Kingdom, Germany, France, Spain, Italy, and Netherlands are also selectable but are unverified — see [README.md § Supported Amazon Regions](README.md#supported-amazon-regions).
- Rate-limit handling: sync stops immediately (no retry) on an HTTP 429 response from Amazon, preserving books already fetched in that run.
- Leveled logging (error/warn/info/debug) with automatic masking of credential-shaped log fields.

### Security

- Amazon credentials (password, one-time code, cookies) are never read, stored, or logged by the plugin — see [PRIVACY.md](PRIVACY.md) and [SECURITY.md](SECURITY.md).
- No analytics, telemetry, or developer-owned server — the only network destination is Amazon and a local Chrome DevTools Protocol connection.

[1.0.1]: https://github.com/x5gtrn/kindle-bridge/releases/tag/1.0.1
[1.0.0]: https://github.com/x5gtrn/kindle-bridge/releases/tag/1.0.0
