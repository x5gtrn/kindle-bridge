# Architecture — Kindle Bridge

Status: Phase 0 design document. Scope: Phase 0–3 MVP (manual sync only). See `docs/mvp-scope.md` for what is explicitly out of scope, and `docs/risks.md` for risk detail.

## 1. Reference project and reuse policy

Reference: [hadynz/obsidian-kindle-plugin](https://github.com/hadynz/obsidian-kindle-plugin), MIT licensed (`Copyright (c) 2016-21 obsidian-kindle-plugin contributors`).

MIT permits reuse (including verbatim code) provided the copyright and permission notice is retained. For this project:

- **No code is copied verbatim.** Kindle Bridge is a clean-room TypeScript implementation with its own module boundaries, naming, and test suite.
- We do reuse several **architectural ideas** that the reference project validated in production (see below). Ideas and public facts are not copyrightable; nothing here is a derivative work of their source.
- Because the reference project meaningfully informed our design decisions, `README.md` includes an **Acknowledgements** section crediting `hadynz/obsidian-kindle-plugin` and linking to its MIT license, as a courtesy and for transparency — not because MIT requires it for independently-written code.
- If we ever copy a non-trivial code fragment verbatim in the future (e.g. a small utility), we will carry the MIT notice next to it and record it in `NOTICE`. No such copying has occurred as of this milestone.

### Ideas reused from the reference project (reimplemented independently)

| Idea | Why we reuse it |
|---|---|
| Electron `BrowserWindow` with a persistent `session` partition (`persist:kindle-bridge`) for Amazon login | Delegates cookie storage to Chromium's own encrypted-at-rest cookie store; no custom credential handling needed. |
| URL-based login-success detection (`did-navigate` → check landed URL against the region's authenticated URL) | Simple, robust, and never touches password/OTP fields. |
| Region registry (`Record<regionId, AmazonRegion>`) | Clean extension point for future regions. |
| Non-destructive resync via a delimited "generated" block + stable per-annotation IDs | Directly required by this project's spec (protect user-edited content). We use an explicit HTML-comment block delimiter (`<!-- kindle-bridge:generated:start/end -->`) plus per-annotation comment markers, which is simpler to reason about than the reference project's line-level diff engine and sufficient for MVP. |
| Decoupled progress/error reporting (event-style callbacks from sync logic to UI) | Keeps `SyncCoordinator` unit-testable without Obsidian UI in the loop. |

### Explicitly redesigned, not reused

- **HTML scraping layer**: rebuilt behind a `KindleReaderClient` + parser boundary with defensive checks (expected-element-count assertions) that fail with an explicit "Amazon page structure may have changed" error instead of silently returning empty data. See §6.
- **Annotation identity**: reference project hashes `title` only (Fletcher checksum) for book IDs and has no stable annotation ID at all. We use ASIN when available for book identity, and a deterministic SHA-256-based ID (spec §"stable annotation ID") for annotations — see `src/models`.
- **Login modal robustness**: explicit success/failure/cancelled/timeout states are modeled (see §4), rather than treating "modal closed early" as silent cancellation.
- **`electron.remote`**: deprecated since Electron 14. We do not use it; see §4 for the constraint this creates and how we work within it.

## 2. High-level component map

```
                        ┌─────────────────────────┐
                        │        main.ts          │  Plugin lifecycle only:
                        │  (KindleBridgePlugin)    │  register commands/ribbon/
                        └───────────┬──────────────┘  settings tab, wire DI
                                    │
        ┌───────────────────────────┼────────────────────────────┐
        │                           │                             │
┌───────▼────────┐        ┌─────────▼──────────┐        ┌─────────▼─────────┐
│   settings/     │        │      sync/          │        │       ui/         │
│ SettingsTab,    │◄──────►│ SyncCoordinator      │◄──────►│ LoginModal,        │
│ SettingsSchema  │        │ KindleSyncService    │        │ SyncProgressModal, │
└─────────────────┘        │ SyncProgress (state) │        │ SyncResultNotice   │
                            └─────────┬────────────┘        └────────────────────┘
                                      │
                ┌─────────────────────┼─────────────────────┐
                │                     │                     │
        ┌───────▼────────┐  ┌─────────▼─────────┐  ┌─────────▼─────────┐
        │    amazon/      │  │     markdown/       │  │      models/       │
        │ AmazonRegion    │  │ BookNoteRenderer     │  │ KindleBook          │
        │ AmazonAuthSvc   │  │ BookNoteRepository   │  │ KindleAnnotation    │
        │ AmazonSessionSvc│  │ FileNameSanitizer    │  │ (pure data types)   │
        │ KindleReaderClnt│  └──────────────────────┘  └─────────────────────┘
        │ KindleBookParser│           uses Obsidian Vault API only
        │ KindleAnnotation│           through BookNoteRepository
        │ Parser (pure fns)│
        └─────────────────┘
```

Dependency direction: `models` has no dependencies. `amazon/*Parser` depends only on `models` (pure functions, DOM string in → domain objects out — no Obsidian, no Electron). `amazon/*Client`/`*Service` depend on Electron APIs and parsers. `markdown/*` depends on `models` and the Obsidian Vault API, not on `amazon/*`. `sync/*` orchestrates `amazon/*` and `markdown/*` and is the only layer that knows about both. `ui/*` and `settings/*` depend on `sync/*` and Obsidian's UI API, never directly on `amazon/*`. `main.ts` only wires dependencies and registers Obsidian entry points (commands, ribbon icon, settings tab) — it must stay thin (no business logic).

This layering directly answers the spec's requirement to keep the Obsidian-dependent surface thin and to separate Amazon access from Markdown persistence.

## 3. Region abstraction

```ts
interface AmazonRegion {
  id: string;               // "jp" | "global" | future: "uk", "de", ...
  label: string;             // display name in settings
  amazonDomain: string;      // e.g. "amazon.co.jp"
  kindleReaderUrl: string;   // e.g. "https://read.amazon.co.jp"
  notebookUrl: string;       // e.g. "https://read.amazon.co.jp/notebook"
  locale?: string;           // for date parsing, e.g. "ja-JP"
}
```

- Implemented as a `Record<string, AmazonRegion>` registry in `src/amazon/AmazonRegion.ts`, with a lookup helper. Adding a region is a one-entry addition plus a parser fixture; no other code changes required, satisfying the "MVP only ships jp/global but must be extensible" requirement.
- MVP shipped exactly two entries, `jp` and `global`, **confirmed working against real accounts** (see `docs/risks.md` R-05). Phase 4 (2026-08-10) added `uk`/`de`/`fr`/`es`/`it`/`nl` as registry scaffolding using the reference project's documented localized reader subdomains (`lire.`, `lesen.`, `leer.`, `leggi.`, `lezen.` for FR/DE/ES/IT/NL respectively; UK uses a plain `read.amazon.co.uk`) - **these six are explicitly unverified against any real account** (see `docs/risks.md` R-20), and their labels in the settings dropdown say so.
- Region selection is a plain settings dropdown (`amazonRegion: "jp" | "global"`), validated against the registry at load time; an unrecognized persisted value falls back to `"jp"` with a warning log (never a crash).

## 4. Authentication and session management

**Mechanism (current, as of 2026-08-07 - the third design tried)**: `AmazonAuthService.signIn()` launches a real, separate Chrome/Edge/Chromium/Brave process (whichever the user already has installed) and drives it via the Chrome DevTools Protocol (CDP) - see `amazon/cdp/`. Amazon's official login UI (including any MFA/CAPTCHA challenge) renders in that independent browser process's own window - the plugin never sees or stores the password, OTP, or any auth header, and this process has no relationship to Obsidian's own window/webContents management at all.

This is the third approach tried for sign-in, not the first - see `docs/risks.md` R-05 for the full investigation trail. Two earlier designs were abandoned after live testing: a separate `remote.BrowserWindow` (a "pop-out"-style window) and an embedded `<webview>` inside an Obsidian `Modal`. Both had their navigation silently redirected to the system browser by something outside this plugin's control on at least Obsidian 1.13.4, confirmed independent of this plugin's own code (a `<webview>` configured to only *observe*, not intercept, navigation still saw the escape happen) and corroborated by an identical, unresolved report against a different, more mature plugin using the `remote.BrowserWindow` approach. A genuinely separate OS-level browser process, entirely outside Obsidian's Electron process, sidesteps that class of problem structurally rather than trying to out-maneuver it. **Playwright/Puppeteer were deliberately not used** to drive this browser: `playwright-core` was tried and found impossible to bundle into the single `main.js` Obsidian Community Plugins require (it reads sibling files via `__dirname`-relative paths at runtime, which don't survive esbuild bundling) - `amazon/cdp/` is a minimal, hand-rolled CDP client (`child_process.spawn` + a WebSocket JSON-RPC layer) using only Node builtins, so it bundles the same way the rest of this plugin does.

- **Browser discovery**: `cdp/browserExecutable.ts` looks for an already-installed Chrome/Edge/Chromium/Brave at well-known OS-specific paths (macOS `/Applications/*.app`, Windows `Program Files`/`LOCALAPPDATA`, Linux `/usr/bin`, `/snap/bin`). It never downloads a browser - if none is found, `AmazonAuthUnsupportedError` is thrown rather than falling back to something less safe.
- **Process launch**: `cdp/CdpBrowser.launch()` first calls `clearStaleSingletonLock()` (removes a leftover `SingletonLock`/`SingletonSocket`/`SingletonCookie` from the profile directory, but only once a signal-0 `process.kill()` check confirms the pid it references is actually dead - see docs/risks.md R-05's 2026-08-10 entry), then spawns the browser with `--remote-debugging-port=0` (OS picks a free port) and `--user-data-dir=<profile>` pointing at a persistent, plugin-owned profile directory (see below), parses the resulting `DevTools listening on ws://...` line from the process's stderr, and connects a WebSocket JSON-RPC client (`cdp/CdpConnection.ts`) to it. If anything after the process has already started fails (e.g. the connection step below), `launch()` kills that process before rethrowing - confirmed necessary by live testing: an earlier version left the process running unmanaged on failure, which then made every subsequent launch attempt fail with Chrome's own "Opening in existing browser session." handoff behavior, since a live process was still holding that profile directory's singleton lock.
- **WebSocket transport**: `cdp/CdpConnection.ts` connects via `cdp/NodeWebSocket.ts`, a minimal RFC 6455 client hand-rolled directly on Node's `net` module - **not** the browser `WebSocket` global. Confirmed by live testing: Obsidian's plugin code runs in an Electron renderer process, which enforces a Content-Security-Policy that blocks the DOM `WebSocket` from connecting to the local DevTools port even though Chrome is up and the port is open - the same restriction Obsidian's own API works around by providing `requestUrl()` instead of relying on `fetch()`. `NodeWebSocket` implements the opening handshake and masked/unmasked text frames (including the extended 16/64-bit length forms, since a full notebook page's HTML can exceed 65535 bytes) plus ping/pong - no new npm dependency, consistent with the rest of this layer.
- **Page control**: `Target.createTarget` + `Target.attachToTarget({flatten: true})` create and attach to a single page on that WebSocket connection (CDP's "flat sessions" mode - no second WebSocket needed); `Page.navigate`, `Page.frameNavigated`, `Page.loadEventFired`, and `Runtime.evaluate` (for reading `document.documentElement.outerHTML`/`location.href`) cover everything this plugin needs.
- **Success detection**: listen for `Page.frameNavigated` (main frame only) on the page; when the resulting URL's origin matches the region's `kindleReaderUrl`, treat as authenticated and close the browser process.
- **Failure/cancellation modeling** (explicit states, unlike the reference project's silent-cancel behavior): `success | cancelled | timeout | navigation-error`, plus a rejected `AmazonAuthUnsupportedError` if no browser is found at all. The browser process exiting on its own (e.g. the user closes the window) before reaching the reader URL is `cancelled`; a hard navigation/network error is surfaced distinctly; a configurable timeout (5 minutes of inactivity) yields `timeout`. All states produce a user-facing `Notice` with distinct copy.
- **Session persistence**: no custom cookie code. Cookies live in the browser's own on-disk profile directory (`--user-data-dir`), the same principle as the `persist:` Electron session partition used in the earlier designs, just backed by the browser's own profile mechanism instead. `AmazonSessionService.isSessionValid()` and `KindleReaderClient` launch a **headless** (`--headless=new`) instance of the same browser against the **same** profile directory, so a session established at sign-in (a visible, headed launch) is usable by them without ever sharing/reading a cookie value directly.
- **Profile directory**: computed once in `main.ts` (`getProfileDir()`) via `FileSystemAdapter.getBasePath()` + the vault's `configDir` + `plugins/<manifest.id>/browser-profile` - an absolute filesystem path outside the vault, since it's opaque browser-engine state, not vault content (the same reasoning as `docs/architecture.md` §7's note on `BookNoteRepository` never touching `fs` directly for *vault* content - this is deliberately the one place this plugin does use Node's `fs`/`child_process` directly, because it's managing browser process state, not vault files).
- **Sign out**: `AmazonAuthService.signOut()` launches the browser headless against the same profile and calls CDP's `Network.clearBrowserCookies` - no visible window needed for this, since it's a background operation with no interactive navigation.
- **429 detection**: `KindleReaderClient` enables the `Network` domain and listens for `Network.responseReceived` events where `type === "Document"`, reading the HTTP status directly - a more reliable signal than the positional, best-effort `httpResponseCode` argument the earlier Electron `did-navigate` design depended on (see the now-resolved R-16).
- **`electron.remote` no longer used at all**: this design change also happens to fully resolve R-08 (the risk that `electron.remote`, deprecated since Electron 14, might not be available on some Obsidian/Electron versions) - there is no `electron.remote` dependency left anywhere in this plugin.
- **Never implemented, by design**: any in-plugin form for email/password/OTP; any scripted auto-fill of Amazon's login form; any CAPTCHA bypass or automation fingerprint spoofing; any browser download/installation (only already-installed browsers are used).
- **Unload safety**: `CdpAmazonAuthService.cancelPendingSignIn()` closes the active sign-in browser process, if any; `main.ts`'s `onunload()` calls it unconditionally (a safe no-op when nothing is pending) so nothing outlives the plugin instance.
- **Testability**: unlike the `<webview>`-based design (which needed a dynamic `import()` workaround since it depended on Obsidian's `Modal`), `amazon/cdp/` has no Obsidian dependency at all, so `AmazonAuthService.ts`/`AmazonSessionService.ts`/`KindleReaderClient.ts` are fully unit-testable under Vitest by mocking `CdpBrowser.launch` (`vi.mock`) - actually spawning a real browser process and completing a real Amazon login remains untestable by automation and is verified manually (`docs/manual-test-checklist.md` §3.1).
- **Confirmed working end-to-end** against a real Amazon account (2026-08-07) - sign-in, session check, book list, per-book annotations, and note creation all verified live; see `docs/risks.md` R-05 for the full verification trail (including two real bugs found and fixed along the way).

## 5. Amazon data retrieval

`KindleReaderClient` (in `src/amazon/`) is the only module allowed to talk to Amazon. It uses the same headless CDP-driven browser process approach as the login flow (§4) - rendering is required because the notebook page is client-rendered - to fetch:

- **Book list**: GET the region's `notebookUrl`, extract each book's rendered HTML, hand off to `KindleBookParser.parseBookList(html): KindleBook[]` (pure function).
- **Per-book annotations**: GET `notebookUrl?asin=<asin>...`, extract rendered HTML, hand off to `KindleAnnotationParser.parseAnnotations(html, bookId): KindleAnnotation[]` (pure function).

**Request discipline** (per spec): concurrency capped at 1–2 in-flight book fetches (`p-limit`-style helper in `src/utils/retry.ts` or a tiny hand-rolled queue — no new heavy dependency), a fixed minimum delay between requests, retry only on transient network errors (timeout, connection reset) with a small bounded retry count and exponential backoff, and an immediate hard-stop (no retry) on HTTP 429. No user-agent spoofing beyond what Electron's default Chromium UA already presents, no CAPTCHA-solving.

**Incremental sync (skip unchanged books, 2026-08-10)**: before fetching a book's annotations, `KindleSyncService.syncOneBook()` calls `needsSync(book.lastAnnotatedAt, lastSyncedAt)` (`sync/needsSync.ts`, pure function) — `lastSyncedAt` is that book's own `last_synced_at` frontmatter value from its existing note, read back via `BookNoteWriter.getLastSyncedAt(bookId)`. If Amazon's book-level `lastAnnotatedAt` (`YYYY-MM-DD`) is before the UTC calendar date of `lastSyncedAt`, nothing has changed on Amazon for this book since it was last synced, so the annotation fetch (and the note write) is skipped entirely — counted in `SyncResult.skippedUpToDate`, distinct from the pre-existing `skipped` (a book that *was* fetched but had nothing to write, see R-13). Fails open to a real sync — never skips — whenever either date is missing or unparseable (a never-synced book, a book Amazon didn't render a date for, or a hand-edited/corrupted frontmatter value), so missing data can never silently hide new content.

**Page-load timeout**: both `KindleReaderClient` and `AmazonSessionService` wrap their `page.waitForLoad()` wait in `utils/timeout.ts`'s `withTimeout()` (30s). This was added after live testing: with no bound, a page that never fires `Page.loadEventFired` (for any reason - a hung subresource, an unexpected redirect) left the wait, and therefore the whole sync, hanging forever - and since `SyncCoordinator`'s re-entrancy lock only clears when the in-flight sync's promise settles, that meant every subsequent "Sync now" failed with `SyncAlreadyInProgressError` until Obsidian was restarted. A stuck fetch now surfaces as a `TransientNetworkError` (retried up to `MAX_ATTEMPTS`) or a `false` session-check result instead.

**Waiting for client-rendered content**: `CdpPage.waitForSelector(selector, timeoutMs)` (`cdp/CdpBrowser.ts`) polls `document.querySelector()` via `Runtime.evaluate` until a match appears or the timeout elapses (never throws - a timeout just means "may genuinely have no highlights"); `KindleReaderClient.fetchBookAnnotationsHtml()` waits on `KindleAnnotationParser.ANNOTATION_SELECTOR` (8s) before snapshotting, while `fetchBookListHtml()` doesn't wait on anything extra, since the book list is already present by `load`. This was added while chasing an initial "every book synced with 0 highlights, errors: 0" live-testing result, on the reasonable-looking theory that per-book content might render asynchronously after `load`. That turned out not to be the actual cause (see §6 and R-02) - the real cause was that `ANNOTATION_SELECTOR` itself no longer matched anything on Amazon's current markup - but the wait is a legitimate defensive addition regardless (content genuinely could load asynchronously in principle) and is kept.

**Progress logging**: `KindleSyncService`, `AmazonSessionService`, and `KindleReaderClient` all log at `info`/`debug` level throughout a sync (session check start/result, book list fetch, per-book "Syncing book N/M", per-page fetch, sync summary) via the shared `Logger` - visible in Obsidian's Developer Console by default (`info` and above) so a run's progress, or where it stalled, is visible without needing to enable the "debug logging" setting.

**Parser resilience contract**: every parser function asserts basic structural expectations (e.g. "book list container exists", "at least the expected top-level fields are present") and throws a typed `KindleParseError` with a message that surfaces as "Amazon's page structure may have changed" — never silently returns empty/undefined data that looks like "the user has 0 books."

## 6. Parser responsibilities (pure functions)

`KindleBookParser` and `KindleAnnotationParser` are the only two modules allowed to know about Amazon's HTML structure. Contract:

- Input: raw HTML string (+ region, for locale-specific date parsing) and, for annotations, the owning book's id.
- Output: arrays of plain `KindleBook` / `KindleAnnotation` domain objects, or a thrown `KindleParseError`.
- No network access, no Electron, no Obsidian API, no I/O — fully unit-testable against static HTML fixtures (see Phase 2 fixtures).
- Owns: title/author extraction, cover image URL extraction, ASIN extraction, highlight vs. note distinction, location extraction, date parsing (region-aware, book-level "last annotated" date only - see below), and **annotation ID / content hash generation** (`src/utils/hash.ts`, SHA-256 over `region + bookId + type + location + normalizedText`, so re-parsing the same annotation is idempotent).

**`KindleAnnotationParser` selectors, confirmed against a real account (2026-08-07)**: the selectors this parser originally shipped with (`.kp-notebook-annotation`, `.kp-notebook-highlight-text`, `.kp-notebook-note-text`, `.kp-annotation-location`, `.kp-annotation-page`, `.kp-annotation-created`) turned out not to match Amazon's actual current markup at all - live testing synced 9/9 books with `errors: 0` but zero highlights/memos, because the *container* selector (`#kp-notebook-annotations`) still matched (no `KindleParseError`) while every per-item selector silently matched nothing. Corrected by inspecting a real account's DOM directly (see `annotations-full.html`'s fixture comment for the full shape): each annotation is a `div` with a generated `id` and Amazon's generic `a-row a-spacing-base` layout classes (`ANNOTATION_SELECTOR = "#kp-notebook-annotations > div.a-row.a-spacing-base"`, scoped with a direct-child combinator since those classes alone are used all over the page); within it, highlight text is `#highlight`, memo text is `#note`, and location is `#kp-annotation-location`'s `value` attribute (as an `id`, not a `class`, despite the similar-looking old selector). **Confirmed the same day: Amazon's current markup exposes no page number and no per-annotation date anywhere** - `KindleAnnotation.page` and `.createdAt` are therefore always `undefined` now (both were already optional - see R-10); if Amazon reintroduces either, only `KindleAnnotationParser.ts` needs to change. See `docs/risks.md` R-02 for the live-testing trail.

**`KindleBookParser` author selector, confirmed against a real account (2026-08-10)**: `authors` never populated. The selector was `"p .kp-notebook-searchable"` (a descendant combinator - matches a `.kp-notebook-searchable` element *inside* a `<p>`), but real markup puts that class directly on the `<p>` itself with nothing nested inside it - a descendant combinator can never match the very element it's scoped from. The neighboring title selector, `"h2.kp-notebook-searchable"` (no space - a compound selector matching the `<h2>` itself), was already written correctly, which is why titles worked while authors silently didn't. Fixed by dropping the stray space. The `books-jp.html`/`books-global.html` fixtures had independently been built with the same wrong shape (a nested `<span>`) rather than reality, which is why this shipped with passing tests - both rewritten to match. Also confirmed the same day: a JP-region (`ja-JP`) account can render `last_annotated_at` in English rather than Japanese - `parseAmazonDate()` now falls through to the generic English parser when the region-specific pattern doesn't match, instead of giving up. See `docs/risks.md` R-02 for the live-testing trail.

**`KindleBookParser` cover image upsizing (2026-08-10)**: the `src` Amazon embeds on the notebook page is pre-sized for its own small list thumbnail via a `_SY<height>`/`_SX<width>` URL suffix (e.g. `.../81W8knGT65L._SY160.jpg`). `amazonImageUrl.ts`'s `upsizeCoverImageUrl()` rewrites that suffix to a larger size (500px, on whichever axis Amazon already scaled by) before the URL is stored on `KindleBook.coverImageUrl` - Amazon serves the same underlying image at any size on request, so this is a URL rewrite only, not a second fetch or a locally-cached/resized copy (R-12 still applies unchanged: the image is never downloaded). URLs that don't match this suffix shape (including every existing fixture, which use plain URLs) pass through unchanged rather than being guessed at.

## 7. Markdown renderer responsibilities

`BookNoteRenderer` (pure function: `KindleBook + KindleAnnotation[] → string` sections) owns generating only the **content of the generated block** (frontmatter fields it *wants* to set, plus the `<!-- kindle-bridge:generated:start -->...<!-- kindle-bridge:generated:end -->` body) — it never reads or writes files directly.

`BookNoteRepository` (the only module that touches the Obsidian Vault API) owns:

- Locating an existing note for a book (by stable book id / ASIN recorded in frontmatter — not by filename, since filenames can be renamed by the user).
- Computing the target file path via `FileNameSanitizer` (illegal-character stripping + ASIN/short-id disambiguation suffix on collision).
- Creating a new note with the full template (frontmatter + generated block + an empty `## My Notes` section) when none exists.
- **Updating an existing note**: read current content, merge frontmatter (shallow overwrite of only `kindle_*`-owned keys, preserving any user-added frontmatter keys — same principle as the reference project's `mergeFrontmatter`), locate the `<!-- kindle-bridge:generated:start/end -->` markers via string search, and replace only the text between them. If the markers are missing (e.g. user deleted them), treat as an error for that note (skip + report, never guess where to reinsert) rather than risk clobbering user content — this can be revisited in a later phase.
- All I/O goes through `Vault.create`/`Vault.process` and `FileManager.processFrontMatter` — never `fs`/`path` node APIs directly, per spec. Frontmatter is merged via `FileManager.processFrontMatter` (Obsidian's own atomic read-modify-write + YAML serialization) rather than hand-rolled YAML string building, so special characters in titles/authors don't need manual escaping.
- **Deletion/diff detection (Phase 4, implemented 2026-08-07 - see `docs/risks.md` R-13)**: individual annotation deletions need no special logic - `updateNote()`'s full-block replace, sourced purely from the current fetch, already drops anything absent from it. `upsert()` additionally now distinguishes three outcomes instead of two: `"skipped"` (no existing note, zero current annotations - avoids clutter notes for never-annotated books), `"updated"` (existing note, including the case where annotations just dropped to zero - the block is cleared to an explicit placeholder rather than left stale), and `"created"` (unchanged). Separately, `flagRemovedBooks(currentBookIds)` scans every managed note (generalizing the same enumeration `findExistingNote()` uses) and, for any whose book id isn't in `currentBookIds` and isn't already flagged, prepends a non-destructive warning banner into the generated block (existing highlights untouched) and sets `kindle_bridge_missing_from_library: true` in frontmatter. Self-healing: `BookNoteRenderer` always explicitly sets that key to `false` on a normal render, so the flag and banner clear themselves the next time that book is actually synced again.
- **Daily Note sync summary (Phase 4, implemented 2026-08-07 - see `docs/risks.md` R-18)**: `DailyNoteAppender` (`src/markdown/DailyNoteAppender.ts`) appends a one-line sync summary to today's Daily Note, opt-in via settings (`dailyNoteSummaryEnabled`, off by default). Deliberately does **not** read Obsidian's actual Daily Notes/`periodic-notes` plugin configuration - there is no official, typed API for that in the `obsidian` package (confirmed by inspecting `node_modules/obsidian/obsidian.d.ts` directly: no `daily`/`periodic` symbols at all), only undocumented `app.internalPlugins`-style internals, which this plugin avoids everywhere else. Instead it uses its own settings (`dailyNoteFolder`, `dailyNoteDateFormat`) to compute today's path via the same `joinVaultPath()` helper `BookNoteRepository` uses, and writes via the same official `Vault.process()` API - the user is responsible for matching these to their real Daily Notes setup. **Never creates the Daily Note itself** - if the resolved path doesn't already exist, this is a silent no-op, specifically to avoid pre-empting Obsidian's own "open today's note" flow (which only applies the user's template on first creation; a bare file created here first would break that). Date formatting uses `obsidian`'s own `moment` export (a real, callable value at runtime, the same one Obsidian's own Daily Notes date-format setting uses) rather than a new dependency - injected into `DailyNoteAppender` as a `formatDate` function (not imported directly) so the class stays unit-testable under Vitest, matching the `getDisplayCoverImage`-style DI pattern used elsewhere; `main.ts` is the one place that resolves the real `moment` value, including a narrow, documented type cast to work around a third-party type-declaration friction between `obsidian.d.ts`'s `import * as Moment from 'moment'` re-export and this project's TypeScript configuration (the value is genuinely callable at runtime; only the inferred type isn't).

**Note on testability**: the `obsidian` npm package ships **types only** (`"main": ""`, no bundled JS) — it's resolved to Obsidian's real runtime implementation only when running inside Obsidian itself (see `esbuild.config.mjs`'s `external` list). Modules that need to stay unit-testable under Vitest (`BookNoteRepository` in particular) therefore only ever `import type` from `"obsidian"`, never a runtime value: `src/utils/vaultPath.ts` reimplements the tiny bit of path-joining `normalizePath()` would otherwise provide, and folder-vs-file detection uses a small duck-typed check (`"children" in node`) instead of `instanceof TFolder`. `main.ts` (never imported by a test) is the one place that imports real Obsidian values (`Plugin`, `Notice`, etc.) directly. **Reviewed as part of Community Plugin submission prep** (`docs/community-plugin-checklist.md`, 2026-08-10): using `joinVaultPath()` instead of Obsidian's actual `normalizePath()` is a deliberate, documented trade-off for this testability, not an oversight - a future reviewer's likely question is already answered here.

## 8. Obsidian API boundary

- `main.ts`: `onload()`/`onunload()`, `registerCommands()`, `addRibbonIcon()`, `addSettingTab()` — composition root only.
- `settings/`: `KindleBridgeSettingTab extends PluginSettingTab` renders controls and delegates persistence to `main.ts`'s `loadData()`/`saveData()` wrapper; `KindleBridgeSettings.ts` defines the schema + defaults + a pure validate/migrate function.
- `ui/LoginModal` and `ui/SyncProgressModal` extend Obsidian's `Modal`; they only render state handed to them by `sync/SyncCoordinator` (via callbacks/state object), containing no business logic themselves.
- `sync/SyncCoordinator` is the single entry point invoked by commands/ribbon; it depends on `amazon/*` and `markdown/*` interfaces and on a small `NotifierPort` (implemented with Obsidian `Notice`) so it can be unit tested by injecting a fake notifier — it does not import `obsidian` types beyond that port interface.
- **Automatic/scheduled sync (Phase 4, implemented 2026-08-10 - see `docs/risks.md` R-19)**: `main.ts`'s `onload()` calls `this.app.workspace.onLayoutReady()` (startup) and, separately, registers a `window.setInterval()` via `this.registerInterval()` (Obsidian's own tracked-interval API, auto-cleared on unload) - both officially typed APIs, both opt-in via settings and off by default. Both just call the existing `runSync()`, now with a `triggeredAutomatically` flag: `SyncCoordinator`'s single-flight lock and `KindleReaderClient`'s request discipline are entirely unaware of what triggered a sync, so no orchestration logic changed - only `main.ts`'s failure UX branches on the flag (silent log-only failure for automatic runs vs. the existing `Notice`-based UX for manual ones, confirmed with the user so a stale session doesn't nag every startup/interval). `autoSyncIntervalMinutes` is clamped to `[15, 360]` both in the settings UI (a `SliderComponent`) and in `normalizeSettings()`, so automatic sync can never be configured to poll Amazon more aggressively than a deliberate manual sync would.

## 9. Future extension points (not built now, but designed for)

- **Additional regions**: add an entry to the `AmazonRegion` registry + a settings dropdown option + fixtures; no parser code changes expected since parsers are structure-based, not domain-based (locale only affects date parsing, already isolated in one function).

## 10. Directory structure

```
src/
  main.ts
  settings/
    KindleBridgeSettings.ts       # schema, defaults, validate/migrate
    KindleBridgeSettingTab.ts     # PluginSettingTab UI
  amazon/
    AmazonRegion.ts               # region registry + type
    AmazonAuthTypes.ts            # AmazonLoginResult, AmazonAuthUnsupportedError
    AmazonAuthService.ts          # CDP-driven login/logout flow
    AmazonSessionService.ts       # session validity check
    KindleReaderClient.ts         # rate-limited fetch of notebook pages
    KindleBookParser.ts           # pure: html -> KindleBook[]
    KindleAnnotationParser.ts     # pure: html -> KindleAnnotation[]
    parseAmazonDate.ts            # region-aware date parsing
    urlSafety.ts                  # safeUrlOrigin() for logging
    cdp/
      browserExecutable.ts        # cross-platform Chrome/Edge/Chromium discovery
      NodeWebSocket.ts             # hand-rolled RFC 6455 client on node:net (bypasses renderer CSP)
      CdpConnection.ts            # minimal CDP JSON-RPC-over-WebSocket client
      CdpBrowser.ts                # launches + drives a browser process via CDP
  sync/
    KindleSyncService.ts          # fetch+parse+normalize orchestration
    SyncCoordinator.ts            # lock, calls KindleSyncService + BookNoteRepository, reports SyncResult
    SyncProgress.ts               # progress/result value types
  markdown/
    BookNoteRepository.ts         # Vault I/O, frontmatter merge, block replace
    BookNoteRenderer.ts           # pure: book+annotations -> markdown block
    DailyNoteAppender.ts          # opt-in: append sync summary to today's Daily Note
    FileNameSanitizer.ts          # pure: title/asin -> safe file name
  models/
    KindleBook.ts
    KindleAnnotation.ts
  ui/
    LoginModal.ts
    SyncProgressModal.ts
  utils/
    dates.ts
    hash.ts
    logger.ts
    retry.ts
    timeout.ts                    # withTimeout() - bounds otherwise-unbounded CDP waits
  tests/
    fixtures/                     # anonymized HTML fixtures (Phase 2)
    ...*.spec.ts
docs/
  architecture.md
  risks.md
  mvp-scope.md
```
