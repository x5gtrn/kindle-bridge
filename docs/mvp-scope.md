# MVP Scope — Kindle Bridge (Phase 0–3)

## In scope for this milestone

### Platform / project setup
- TypeScript Obsidian desktop plugin (`isDesktopOnly: true`), buildable with esbuild, lintable with ESLint, formattable with Prettier, testable with Vitest or Jest.
- Standard plugin scaffold: `manifest.json`, `package.json`, `tsconfig.json`, `esbuild.config.mjs`, ESLint/Prettier config, `versions.json`, `README.md`, `LICENSE`.

### Settings
- Amazon region: `jp` (Japan) or `global` (US/Global), via an extensible region registry.
- Output folder (default `Highlight and Note/Books`).
- Display cover image (on/off).
- Debug logging (on/off), with authentication data always masked regardless of this setting.

### Authentication
- Sign in via Amazon's **official** login page rendered inside an Electron `BrowserWindow` (or documented failure if the host Obsidian/Electron version cannot support this — see `docs/risks.md` R-08).
- Session persisted via Electron's own `persist:` cookie partition; no custom cookie/credential storage.
- Session validity check before sync.
- Sign out (clears the session partition).
- MFA and CAPTCHA are handled entirely within Amazon's own page; the plugin does not intercept, bypass, or special-case them.

### Data retrieval
- Book list retrieval for the `jp` and `global` regions.
- Highlight retrieval.
- Note retrieval, associated with their originating highlight where Amazon's markup associates them.
- Rate-limited, low-concurrency (1–2) requests with bounded retries on transient errors only, hard stop on HTTP 429.

### Parsing and domain model
- `KindleBook` and `KindleAnnotation` models as specified, with a deterministic content-hash-based annotation ID when Amazon provides no stable ID.
- Pure-function parsers (no I/O), covered by anonymized HTML fixtures and unit tests for: book list parsing, highlight parsing, note parsing, highlight/note association, location parsing, page parsing, date parsing (including missing dates), missing/malformed fields, JP vs. Global differences, malformed HTML (no crash), annotation ID reproducibility, content hash reproducibility.

### Markdown generation and storage
- One Markdown note per book, filename derived from title, disambiguated with ASIN/short ID on collision, illegal filename characters sanitized.
- Frontmatter with the fields specified in the plugin spec (`kindle_bridge`, `kindle_book_id`, `asin`, `title`, `authors`, `amazon_region`, `amazon_url`, `cover_image_url`, `last_annotated_at`, `annotation_count`, `highlight_count`, `note_count`, `last_synced_at`, `tags`).
- A clearly delimited generated block (`<!-- kindle-bridge:generated:start/end -->`) containing all highlights/notes; content outside this block (including a `## My Notes` section) is never modified by sync after initial creation.
- Cover images referenced by their Amazon URL only — never downloaded locally; clicking the cover opens the Amazon book page or Kindle Reader.
- All file I/O through the Obsidian Vault API, not raw filesystem APIs.

### Manual sync
- Manual trigger only, via Command Palette (`Sign in to Amazon`, `Sync now`, `Sign out from Amazon`, `Open settings`) and a ribbon icon for sync.
- Single-flight sync lock (no concurrent syncs).
- Per-book failure isolation: one book failing does not stop the whole sync; only continuation-breaking errors (e.g. session expiry) stop the whole run.
- Sync result summary shown to the user: books fetched, notes created, notes updated, highlights fetched, notes fetched, skipped count, error count.

### Error handling
All of: not signed in, session expired, MFA required, CAPTCHA presented, network error, HTTP error, region mismatch, book list fetch failure, single-book fetch failure, parser failure (surfaced as a possible Amazon layout change), invalid date, invalid filename, vault folder creation failure, markdown save failure, duplicate sync attempt.

### Logging
Leveled logging (`error`/`warn`/`info`/`debug`) that never emits passwords, cookies, session tokens, OTPs, auth headers, raw Amazon response bodies, or full highlight/note text — including when debug logging is enabled.

### Quality gates
`npm run build`, `npm run typecheck`, `npm run lint`, `npm test` all passing, no `any`, no disabled/skipped tests, no dead code.

## Explicitly out of scope for this milestone (deferred to Phase 4+)

- ~~Detecting and removing highlights/memos that were deleted on Amazon's side.~~ **Implemented in Phase 4 (2026-08-07)** - see `docs/architecture.md` §7 and `docs/risks.md` R-13. Kept here, struck through, as a historical record of this milestone's original scope rather than rewritten.
- Differential/incremental update logic beyond the simple "regenerate the generated block" approach (no line-level diffing, no per-annotation change detection beyond regenerating the whole block).
- ~~Daily Notes integration.~~ **Implemented in Phase 4 (2026-08-07)** - see `docs/architecture.md` §7 and `docs/risks.md` R-18. Opt-in, uses its own settings rather than Obsidian's real Daily Notes plugin config (no official API exists for that).
- Dataview integration. (No dedicated integration code is needed for this: Dataview queries any note's frontmatter directly, and this plugin's frontmatter - `kindle_book_id`, `highlight_count`, `tags`, etc. - is already queryable as-is. Deferred item, if ever revisited, would be finer-grained per-highlight querying, e.g. inline Dataview fields on each annotation block.)
- ~~Automatic sync on Obsidian startup.~~ **Implemented in Phase 4 (2026-08-10)** - opt-in, off by default. See `docs/architecture.md` §8 and `docs/risks.md` R-19.
- ~~Scheduled/timed automatic sync.~~ **Implemented in Phase 4 (2026-08-10)**, alongside sync-on-startup above - same settings toggle group, same silent-failure UX.
- ~~Support for Amazon regions beyond Japan and Global.~~ **Partially addressed in Phase 4 (2026-08-10)**: UK/DE/FR/ES/IT/NL added to the region registry (see `docs/architecture.md` §3), but - unlike Japan/Global - **not verified against any real account**; see `docs/risks.md` R-20.
- Advanced sync cancellation (mid-flight cancel UI/token beyond the basic single-flight lock).
- Community Plugin submission (directory listing, submission PR to `obsidian-releases`, etc.).
- Mobile support (desktop-only by design, see `docs/risks.md` R-09).

## Architectural note

Although differential sync, deletion detection, and Daily Notes integration are out of scope now, the design in `docs/architecture.md` §9 (stable annotation IDs + content hashes, a structured `SyncResult` value, and a repository layer that already isolates all Vault I/O) is intended to make those additions in a later phase incremental rather than requiring a rewrite.
