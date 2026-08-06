# Architecture — Obsidian Kindle Bridge

Status: Phase 0 design document. Scope: Phase 0–3 MVP (manual sync only). See `docs/mvp-scope.md` for what is explicitly out of scope, and `docs/risks.md` for risk detail.

## 1. Reference project and reuse policy

Reference: [hadynz/obsidian-kindle-plugin](https://github.com/hadynz/obsidian-kindle-plugin), MIT licensed (`Copyright (c) 2016-21 obsidian-kindle-plugin contributors`).

MIT permits reuse (including verbatim code) provided the copyright and permission notice is retained. For this project:

- **No code is copied verbatim.** Obsidian Kindle Bridge is a clean-room TypeScript implementation with its own module boundaries, naming, and test suite.
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
- **Annotation identity**: reference project hashes `title` only (Fletcher checksum) for book IDs and has no stable annotation ID at all. We use ASIN when available for book identity, and a deterministic SHA-256-based ID (spec §"安定したAnnotation ID") for annotations — see `src/models`.
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
- MVP ships exactly two entries: `jp` (`amazon.co.jp`, `read.amazon.co.jp`) and `global` (`amazon.com`, `read.amazon.com`). The reference project's data (localized reader subdomains such as `lire.`, `lesen.`, `leer.`, `leggi.`, `lezen.` for other locales) is recorded in this file as a comment for future contributors, but those regions are not enabled in MVP.
- Region selection is a plain settings dropdown (`amazonRegion: "jp" | "global"`), validated against the registry at load time; an unrecognized persisted value falls back to `"jp"` with a warning log (never a crash).

## 4. Authentication and session management

**Mechanism**: `AmazonAuthService` opens a real Electron `BrowserWindow` pointed at the region's `notebookUrl`, on a dedicated persistent session partition `persist:obsidian-kindle-bridge`. Amazon serves its own official login UI (including any MFA/CAPTCHA challenge) inside that window — the plugin never sees or stores the password, OTP, or any auth header.

- **Success detection**: listen to `did-navigate` (and `did-navigate-in-page` for SPA-style redirects) on `webContents`; when the resulting URL's origin matches the region's `kindleReaderUrl`, treat as authenticated, close the window, and resolve.
- **Failure/cancellation modeling** (explicit states, unlike the reference project's silent-cancel behavior): `success | cancelled | timeout | navigation-error`. A window closed by the user before reaching the reader URL is `cancelled`; a hard navigation/network error is surfaced distinctly; a configurable timeout (e.g. 5 minutes of inactivity) yields `timeout`. All three non-success states produce a user-facing `Notice` with distinct copy.
- **Session persistence**: no custom cookie code. The `persist:` session partition is Chromium's own on-disk, OS-protected cookie store, scoped to that partition name, and survives Obsidian restarts automatically. `AmazonSessionService.isSessionValid()` performs a lightweight authenticated GET (e.g. HEAD/GET against the notebook URL through the same partition) and checks whether the response is the reader page or a redirect to a login page, without ever logging response bodies.
- **Sign out**: `AmazonAuthService.signOut()` opens a hidden `BrowserWindow` on the same partition and calls `session.clearStorageData()` for that partition — mirrors the reference project's approach, which needs no custom cookie parsing.
- **`electron.remote` avoidance**: `electron.remote` is deprecated (Electron 14+) and Obsidian's bundled Electron may not expose it without the `@electron/remote` polyfill, which Obsidian does not ship for plugins. Constraint and resolution are documented in `docs/risks.md` — MVP uses `require('electron').remote` **only if present at runtime** (guarded with a capability check), and if unavailable, surfaces a clear "your Obsidian/Electron version doesn't support in-app Amazon login" error rather than crashing or falling back to an insecure method. See risk R-08.
- **Never implemented, by design**: any in-plugin form for email/password/OTP; any scripted auto-fill of Amazon's login form; any CAPTCHA bypass or automation fingerprint spoofing.
- **Unload safety**: a sign-in in progress holds a pending timeout (up to `LOGIN_TIMEOUT_MS`). `ElectronAmazonAuthService.cancelPendingSignIn()` closes the window and clears that timeout; `main.ts`'s `onunload()` calls it unconditionally (a safe no-op when nothing is pending) so a stray timer can never fire after the plugin instance is gone. Added during the MVP acceptance audit - see `docs/mvp-acceptance-report.md`.

## 5. Amazon data retrieval

`KindleReaderClient` (in `src/amazon/`) is the only module allowed to talk to Amazon. It uses the same hidden, off-screen `BrowserWindow` + `session` partition approach as the login flow (rendering is required because the notebook page is client-rendered) to fetch:

- **Book list**: GET the region's `notebookUrl`, extract each book's rendered HTML, hand off to `KindleBookParser.parseBookList(html): KindleBook[]` (pure function).
- **Per-book annotations**: GET `notebookUrl?asin=<asin>...`, extract rendered HTML, hand off to `KindleAnnotationParser.parseAnnotations(html, bookId): KindleAnnotation[]` (pure function).

**Request discipline** (per spec): concurrency capped at 1–2 in-flight book fetches (`p-limit`-style helper in `src/utils/retry.ts` or a tiny hand-rolled queue — no new heavy dependency), a fixed minimum delay between requests, retry only on transient network errors (timeout, connection reset) with a small bounded retry count and exponential backoff, and an immediate hard-stop (no retry) on HTTP 429. No user-agent spoofing beyond what Electron's default Chromium UA already presents, no CAPTCHA-solving.

**Parser resilience contract**: every parser function asserts basic structural expectations (e.g. "book list container exists", "at least the expected top-level fields are present") and throws a typed `KindleParseError` with a message that surfaces as "Amazon's page structure may have changed" — never silently returns empty/undefined data that looks like "the user has 0 books."

## 6. Parser responsibilities (pure functions)

`KindleBookParser` and `KindleAnnotationParser` are the only two modules allowed to know about Amazon's HTML structure. Contract:

- Input: raw HTML string (+ region, for locale-specific date parsing) and, for annotations, the owning book's id.
- Output: arrays of plain `KindleBook` / `KindleAnnotation` domain objects, or a thrown `KindleParseError`.
- No network access, no Electron, no Obsidian API, no I/O — fully unit-testable against static HTML fixtures (see Phase 2 fixtures).
- Owns: title/author extraction, cover image URL extraction, ASIN extraction, highlight vs. memo distinction, location/page extraction, date parsing (region-aware), and **annotation ID / content hash generation** (`src/utils/hash.ts`, SHA-256 over `region + bookId + type + location + normalizedText + createdDate`, so re-parsing the same annotation is idempotent).

## 7. Markdown renderer responsibilities

`BookNoteRenderer` (pure function: `KindleBook + KindleAnnotation[] → string` sections) owns generating only the **content of the generated block** (frontmatter fields it *wants* to set, plus the `<!-- kindle-bridge:generated:start -->...<!-- kindle-bridge:generated:end -->` body) — it never reads or writes files directly.

`BookNoteRepository` (the only module that touches the Obsidian Vault API) owns:

- Locating an existing note for a book (by stable book id / ASIN recorded in frontmatter — not by filename, since filenames can be renamed by the user).
- Computing the target file path via `FileNameSanitizer` (illegal-character stripping + ASIN/short-id disambiguation suffix on collision).
- Creating a new note with the full template (frontmatter + generated block + an empty `## My Notes` section) when none exists.
- **Updating an existing note**: read current content, merge frontmatter (shallow overwrite of only `kindle_*`-owned keys, preserving any user-added frontmatter keys — same principle as the reference project's `mergeFrontmatter`), locate the `<!-- kindle-bridge:generated:start/end -->` markers via string search, and replace only the text between them. If the markers are missing (e.g. user deleted them), treat as an error for that note (skip + report, never guess where to reinsert) rather than risk clobbering user content — this can be revisited in a later phase.
- All I/O goes through `Vault.create`/`Vault.process` and `FileManager.processFrontMatter` — never `fs`/`path` node APIs directly, per spec. Frontmatter is merged via `FileManager.processFrontMatter` (Obsidian's own atomic read-modify-write + YAML serialization) rather than hand-rolled YAML string building, so special characters in titles/authors don't need manual escaping.

**Note on testability**: the `obsidian` npm package ships **types only** (`"main": ""`, no bundled JS) — it's resolved to Obsidian's real runtime implementation only when running inside Obsidian itself (see `esbuild.config.mjs`'s `external` list). Modules that need to stay unit-testable under Vitest (`BookNoteRepository` in particular) therefore only ever `import type` from `"obsidian"`, never a runtime value: `src/utils/vaultPath.ts` reimplements the tiny bit of path-joining `normalizePath()` would otherwise provide, and folder-vs-file detection uses a small duck-typed check (`"children" in node`) instead of `instanceof TFolder`. `main.ts` (never imported by a test) is the one place that imports real Obsidian values (`Plugin`, `Notice`, etc.) directly.

## 8. Obsidian API boundary

- `main.ts`: `onload()`/`onunload()`, `registerCommands()`, `addRibbonIcon()`, `addSettingTab()` — composition root only.
- `settings/`: `KindleBridgeSettingTab extends PluginSettingTab` renders controls and delegates persistence to `main.ts`'s `loadData()`/`saveData()` wrapper; `KindleBridgeSettings.ts` defines the schema + defaults + a pure validate/migrate function.
- `ui/LoginModal` and `ui/SyncProgressModal` extend Obsidian's `Modal`; they only render state handed to them by `sync/SyncCoordinator` (via callbacks/state object), containing no business logic themselves.
- `sync/SyncCoordinator` is the single entry point invoked by commands/ribbon; it depends on `amazon/*` and `markdown/*` interfaces and on a small `NotifierPort` (implemented with Obsidian `Notice`) so it can be unit tested by injecting a fake notifier — it does not import `obsidian` types beyond that port interface.

## 9. Future extension points (not built now, but designed for)

- **Differential sync / deletion detection (Phase 4+)**: `KindleAnnotation.contentHash` and stable `id` already exist; a future `AnnotationDiffService` can compare a persisted "last seen annotation IDs per book" set (stored in frontmatter or a small sidecar in plugin data) against a fresh fetch to detect removals, without changing the parser or renderer contracts.
- **Daily Notes integration (Phase 4+)**: `SyncCoordinator` already emits a structured `SyncResult` (per-book, per-annotation-count); a future `DailyNoteAppender` can subscribe to that result and append a summary line via Obsidian's Daily Notes / `periodic-notes` API without touching `BookNoteRepository`.
- **Additional regions**: add an entry to the `AmazonRegion` registry + a settings dropdown option + fixtures; no parser code changes expected since parsers are structure-based, not domain-based (locale only affects date parsing, already isolated in one function).
- **Automatic/scheduled sync**: `SyncCoordinator.sync()` is already the single re-entrant-safe entry point (guarded by an internal lock per spec); a future scheduler just needs to call it on a timer/`workspace.on('layout-ready')`/etc.

## 10. Directory structure

```
src/
  main.ts
  settings/
    KindleBridgeSettings.ts       # schema, defaults, validate/migrate
    KindleBridgeSettingTab.ts     # PluginSettingTab UI
  amazon/
    AmazonRegion.ts               # region registry + type
    AmazonAuthService.ts          # BrowserWindow login/logout flow
    AmazonSessionService.ts       # session validity check
    KindleReaderClient.ts         # rate-limited fetch of notebook pages
    KindleBookParser.ts           # pure: html -> KindleBook[]
    KindleAnnotationParser.ts     # pure: html -> KindleAnnotation[]
  sync/
    KindleSyncService.ts          # fetch+parse+normalize orchestration
    SyncCoordinator.ts            # lock, calls KindleSyncService + BookNoteRepository, reports SyncResult
    SyncProgress.ts               # progress/result value types
  markdown/
    BookNoteRepository.ts         # Vault I/O, frontmatter merge, block replace
    BookNoteRenderer.ts           # pure: book+annotations -> markdown block
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
  tests/
    fixtures/                     # anonymized HTML fixtures (Phase 2)
    ...*.spec.ts
docs/
  architecture.md
  risks.md
  mvp-scope.md
```
