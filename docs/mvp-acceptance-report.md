# MVP Acceptance Report

Date: 2026-08-06
Scope: Phase 0-3 (MVP) implementation, audited before proceeding to Phase 4.
Auditor: Claude (this session), self-auditing its own prior implementation work.

## Summary

The Phase 0-3 codebase is clean, builds/typechecks/lints/tests successfully from a
fully clean install, and contains no stubs, mocks-only implementations, disabled tests,
`any`, unjustified `eslint-disable`, or credential/cookie logging paths. This audit
found and fixed **two real defects** (a `minAppVersion` too low for an API the plugin
actually calls, and a dangling 5-minute timer not cleared on plugin unload) and **two
minor dead-code items** (removed). Test coverage was extended from 117 to 132 tests to
close gaps identified against the audit checklist (illegal-character titles through the
full repository path, broken/reversed generated-block markers, all-books-succeed and
`notesUpdated` counting, explicit `TransientNetworkError`/`KindleParseError` per-book
isolation, present-but-empty vs. absent optional fields).

**What this audit could verify:** all pure logic (HTML parsing, Markdown rendering,
sync orchestration, the Vault-persistence layer against an in-memory fake Vault, error
classification, security-relevant logging behavior) via 132 automated tests plus static
code review, run from a completely clean `rm -rf node_modules && npm install` state.

**What this audit could NOT verify:** anything requiring a real Obsidian desktop
process or a real Electron `BrowserWindow` talking to a real Amazon account - i.e.,
actual plugin loading, actual Amazon sign-in/MFA/CAPTCHA, actual session-validity
checks, actual book-list/annotation fetching, and actual rendering of the generated
Markdown inside Obsidian's editor. This environment has no Obsidian or Electron
runtime available. These items are marked `NOT TESTED` below, not `PASS`, and
`docs/manual-test-checklist.md` gives you exact steps to run them yourself.

## Repository Audit

| Finding | Severity | Status |
|---|---|---|
| Uncommitted changes / untracked files before this audit started | - | None found - working tree was clean |
| TODO / FIXME / HACK / XXX comments | - | None found |
| `any` (explicit type or `as any`) | - | None found |
| `@ts-ignore` / `@ts-expect-error` | - | None found |
| `eslint-disable` | Low | One instance (`electronRemote.ts`, `no-require-imports`), narrowly scoped with an inline justification for the lazy `require("electron")` capability check. Judged appropriate, not a smell. |
| Disabled tests (`.skip`, `.only`, `xdescribe`/`xit`) | - | None found |
| Empty function bodies / always-fixed-value stubs | - | None found. `onunload()` was a documented no-op but that was itself the bug described below (fixed). |
| Mock-only / stub implementations left in production code | - | None - every Phase 1 stub (`NotImplementedYetError`) was replaced with a real implementation by end of Phase 3, and the file defining it was deleted as dead code in the Phase 3 commit `15fc9fd`. |
| Unreachable code | - | None found |
| Unused classes/functions (dead exports) | Low | Found 3, resolved 2, kept 1 with justification - see "Non-blocking Issues" |
| Hardcoded Amazon URLs outside the region registry | - | None - all Amazon domains/URLs live in `src/amazon/AmazonRegion.ts`; every other reference is in a test or fixture file |
| Hardcoded local filesystem paths | - | None found |
| Cookie/password/OTP/session-token logging risk | - | None - grepped every `logger.*()` call site; only origins (via `safeUrlOrigin`), error codes, our own static error messages, and book titles/paths are ever logged. Highlight/memo text and cookies are never passed to the logger anywhere in the codebase. |
| Build artifacts or secrets tracked in git | - | None - `.gitignore` correctly excludes `node_modules/`, `main.js`, `data.json`, `coverage/`; `git ls-files` grep for `.env`/`data.json`/`main.js`/`secret`/`credential` returned nothing |

## Completion Criteria

Evidence column references test file names (all under `src/`) or specific code. Where
a criterion has both a "logic" half (testable without Obsidian/Amazon) and a "live"
half (not testable here), both are noted.

| Item | Status | Evidence | Manual Test Required |
|---|---|---|---|
| ObsidianでPluginを読み込める | NOT TESTED | `manifest.json` valid, `main.ts` exports a `Plugin` subclass, build produces `main.js` | §1.1-1.4 of manual-test-checklist.md |
| Settings画面を開ける | NOT TESTED | `KindleBridgeSettingTab` implements `display()` correctly; registered via `addSettingTab` | §2 |
| Amazon Japanを選択できる | PARTIAL | Region data + settings persistence logic: PASS (`AmazonRegion.spec.ts`, `KindleBridgeSettings.spec.ts`). UI interaction: NOT TESTED | §2.1 |
| Amazon Global / United Statesを選択できる | PARTIAL | Same as above | §2.2 |
| Amazon公式ログイン画面を表示できる | NOT TESTED | Implemented via real `BrowserWindow` navigation (`AmazonAuthService.ts`); guarded-fallback path is tested, the live path is not | §3.1 |
| MFAをAmazon公式画面上で処理できる | NOT TESTED | By design, not intercepted - nothing to unit test | §3.2 |
| CAPTCHA発生時に安全に停止または案内できる | NOT TESTED | No bypass code exists (verified by review); a 5-minute timeout produces a Notice if navigation never completes. Not exercised against a real CAPTCHA | §3.3 |
| Amazonセッションを確認できる | NOT TESTED | `AmazonSessionService` implemented; only its Electron-unavailable fallback is unit tested | §3.4 |
| Sign outできる | NOT TESTED | Same as above | §3.6 |
| 手動同期を実行できる | PARTIAL | Orchestration logic: PASS (12 tests in `KindleSyncService.spec.ts`). Live execution against real Amazon: NOT TESTED | §4.1 |
| 同時に複数の同期が走らない | PASS | `SyncCoordinator.spec.ts` - explicit concurrent-call rejection test, no live dependency needed | - |
| Amazon Japanの書籍一覧を取得できる | PARTIAL | Parsing logic: PASS (`KindleBookParser.spec.ts`, Japan fixture). Live fetch: NOT TESTED | §4.1, §4.3 |
| Amazon Globalの書籍一覧を取得できる | PARTIAL | Same, Global fixture | §4.1, §4.3 |
| Highlightを取得できる | PARTIAL | Parsing logic PASS (`KindleAnnotationParser.spec.ts`). Live fetch NOT TESTED | §4.4 |
| Memoを取得できる | PARTIAL | Parsing logic PASS. Live fetch NOT TESTED | §4.5 |
| HighlightとMemoを正しく関連付けられる | PASS* | Thoroughly unit tested (highlight-only, highlight+memo, memo-only cases). *Caveat: fixture HTML structure is our best-effort reconstruction of Amazon's real markup (docs/risks.md R-02), not captured from a live page | §4.5 |
| Locationを取得できる | PASS* | Tested (present/absent/blank-value cases). Same fixture caveat | §5.7 |
| Pageを取得できる | PASS* | Tested. Same fixture caveat | §5.8 |
| 作成日を取得できる | PASS* | Tested (JP and Global date formats, present/absent). Same fixture caveat | §5.9 |
| 書籍ごとのMarkdownを生成できる | PASS | `BookNoteRenderer.spec.ts` (16 tests), `BookNoteRepository.spec.ts` (17 tests against an in-memory fake Vault) | §5.1-5.2 |
| 表紙画像をAmazon URLで表示できる | PARTIAL | Markdown generation of the image embed: PASS. Actual image load/display inside Obsidian: NOT TESTED | §5.3 |
| 表紙画像からAmazonページへ遷移できる | PARTIAL | Renderer wraps the cover in a link to `amazonUrl`: PASS (explicit assertion). Actual click-through in Obsidian's UI: NOT TESTED | §5.4 |
| 同名書籍のファイル名衝突を回避できる | PASS | `BookNoteRepository.spec.ts`: "disambiguates the file name when an unrelated file already occupies the plain path" | - |
| 不正文字を含む書籍タイトルを保存できる | PASS | `FileNameSanitizer.spec.ts` (unit) + new integration test in `BookNoteRepository.spec.ts`: "saves a book note when the title contains characters illegal in file names" | - |
| ユーザー編集領域を保持できる | PASS | `BookNoteRepository.spec.ts`: "preserves user content outside the generated block on update" | §5.15 |
| 管理ブロックのみを更新できる | PASS | Same test, plus 3 broken-marker tests (missing end, missing start, reversed order) all added this audit | §5.16 |
| 再同期でAnnotationが不必要に重複しない | PASS | The generated block is fully replaced (not appended) on every sync - verified via the same preservation test asserting stale content is gone, not duplicated alongside new content | §4.2 |
| 一冊の取得失敗で他の書籍を継続できる | PASS | `KindleSyncService.spec.ts`: mixed success/failure test, plus new explicit `TransientNetworkError` and `KindleParseError` isolation tests | §4.8 |
| 認証切れ時に同期を停止できる | PASS | Pre-flight `isSessionValid()` check and reactive mid-sync `AmazonSessionExpiredError` handling both tested as continuation-breaking | §3.5 |
| Amazon HTML変更時に分かりやすいエラーを表示できる | PASS | `KindleParseError` → "Amazon's page structure may have changed" message, tested in both parser spec files and via `BookListFetchError` wrapping | - |
| Cookieをログへ出力しない | PASS | Verified by code review (cookies are never read by any code in this project - see docs/architecture.md §4) and by `logger.spec.ts`'s masking tests as defense-in-depth | §Security spot-checks |
| Passwordを保存しない | PASS | No password field exists anywhere in the codebase; `LoginModal` has no input fields (confirm/cancel buttons only) | §Security spot-checks |
| OTPを保存しない | PASS | No OTP handling code exists | §Security spot-checks |
| Amazonレスポンス全文をログへ出力しない | PASS | Verified by grepping every `logger.*()` call site | §Security spot-checks |
| HighlightやMemoの全文を通常ログへ出力しない | PASS | `annotation.text`/`annotation.memo` only ever flow into `BookNoteRenderer`'s Markdown output, never into a `logger.*()` call (grep-verified) | - |
| READMEにMVPの制約が記載されている | PASS | README.md "MVP limitations" section | - |
| ライセンス表示が適切である | PASS | `LICENSE` (MIT), `package.json` license field, README License section all consistent | - |
| 参考リポジトリへの謝辞が適切である | PASS | README Acknowledgements section credits hadynz/obsidian-kindle-plugin (MIT) | - |

## Build and Test Results

All four commands run from a **fully clean state** (`rm -rf node_modules dist && rm -f
main.js && npm install`), per the audit instructions:

| Command | Exit code | Notes |
|---|---|---|
| `npm install` | 0 | 171 packages added, 0 vulnerabilities. Warnings: 1 deprecation notice (`whatwg-encoding`, a transitive dependency of cheerio, upstream's concern not ours) and an `allow-scripts` notice that `esbuild`/`fsevents` postinstall scripts didn't run (this sandbox's npm config) - `esbuild` was verified working regardless (`npx esbuild --version` → `0.28.1`) |
| `npm run typecheck` | 0 | No output (clean) |
| `npm run lint` | 0 | No output (clean) |
| `npm test` | 0 | **19 test files, 132 tests, 132 passed, 0 failed, 0 skipped** |
| `npm run build` | 0 | Produced `main.js`, 402,134 bytes, correct banner header |

No test was disabled, skipped, or had its assertions weakened to force a pass.

## Test Coverage Gaps

Closed during this audit (15 new tests added, 117 → 132):

- Illegal-character book title through the **full** `BookNoteRepository.upsert()` path (previously only unit-tested in isolation at the `FileNameSanitizer` level)
- Broken generated-block markers: only start marker present, only end marker present, markers present but reversed order (previously only "both markers absent" was tested)
- `amazonUrl` absent in `BookNoteRenderer` (cover-image link fallback, "Amazon:" line omission)
- Markdown special characters in highlight/memo text (documents current pass-through behavior)
- YAML-special characters in title/authors passed through to the frontmatter object unmodified by our own code
- All-books-succeed sync scenario (previously only mixed success/failure was tested)
- `notesUpdated` counting (previously every test's fake repository always returned `"created"`)
- Explicit `TransientNetworkError` and `KindleParseError` as per-book (non-continuation-breaking) failures in `KindleSyncService` (previously only a generic `Error` was used, which happened to exercise the same code path but wasn't traceable to the real error types)
- Present-but-empty vs. absent optional annotation fields (memo element present but blank; location/page/created attributes present but empty)

**Remaining, accepted gaps** (require either a real Electron runtime or were judged
disproportionate effort relative to value):

- `ElectronKindleReaderClient`'s actual retry-loop wiring (does it really call
  `retryAsync` with `maxAttempts: 3` and the right `isRetryable` predicate against a
  real failing request?) is verified by code review only. The underlying `retryAsync`
  mechanism itself is thoroughly unit tested in isolation (`utils/retry.spec.ts`,
  Phase 1).
- `ElectronAmazonAuthService.cancelPendingSignIn()` actually cancelling a real in-flight
  sign-in (closing the window, clearing the timeout) is verified by code review only;
  the automated test only confirms it's a safe no-op when nothing is pending. Fully
  faking Electron's `BrowserWindow`/`webContents` event API (including its overloaded
  `on()` signatures) was judged disproportionate effort for this one fix.
- HTTP 429 detection depends on an assumed `did-navigate` event signature
  (`docs/risks.md` R-16) - not verified against a real Electron build.
- Real YAML frontmatter serialization correctness (does Obsidian's own
  `processFrontMatter` handle our title/author strings safely?) is outside this
  project's code and cannot be exercised without real Obsidian.

## Security Review

All items PASS. See the Completion Criteria table above for the credential/logging
items specifically. Additional checks run for this section:

- `npm audit`: **0 vulnerabilities** (re-run after the clean install in this audit).
- Dependency tree review (`npm ls --prod --all`): the only runtime dependency is
  `cheerio` and its standard, well-known HTML-parsing sub-dependencies (`css-select`,
  `domhandler`, `parse5`, `htmlparser2`, etc.). No analytics, telemetry, or networking
  SDK beyond what cheerio itself pulls in transitively. **Note**: cheerio's optional
  `undici` sub-dependency gets bundled but is never invoked by our code (we only ever
  call `cheerio.load(htmlString)` on already-fetched HTML, never cheerio's own fetch
  helpers) - this is unused bundle weight, not a security concern.
- Every `BrowserWindow.loadURL()` call site was enumerated (`grep -n "loadURL("`): all
  three navigate only to `region.notebookUrl` or `region.notebookUrl + "?asin=..."`
  (ASIN is a public product identifier, URL-encoded before interpolation) - no
  possibility of a session token or credential leaking into a URL we construct
  ourselves, and therefore into any error message derived from a failed navigation.
- `LoginModal.ts` re-inspected line by line: two buttons only, no `addText`/input
  fields of any kind.
- No User-Agent override, no CAPTCHA-solving code, no access-restriction-bypass code
  anywhere in the codebase (grep + full read of `amazon/` and `ui/` directories).

## Obsidian API Review

| Item | Status | Notes |
|---|---|---|
| Vault file operations use the Obsidian Vault API | PASS | `BookNoteRepository` exclusively uses `Vault.create`/`Vault.process`/`Vault.createFolder`/`Vault.getAbstractFileByPath`/`Vault.getMarkdownFiles` + `FileManager.processFrontMatter` |
| No unnecessary `fs` dependency | PASS | `node:fs` appears only in three `*.spec.ts` files, to load test fixtures under Vitest/Node - never in code reachable from `main.ts`, never bundled |
| Timers/events released on unload | **FIXED** | Was FAIL: a 5-minute sign-in timeout (`setTimeout`) was not cleared on `onunload()`, so it could fire after the plugin instance was gone. Fixed by adding `ElectronAmazonAuthService.cancelPendingSignIn()`, called from `onunload()` |
| Register API used appropriately | PASS | `addCommand`/`addRibbonIcon`/`addSettingTab` used correctly (Obsidian auto-cleans these on unload); no `registerInterval`/`registerEvent` needed since the plugin has no repeating timers or workspace-event listeners after the fix above |
| Notice not shown excessively | PASS | Notices only fire in direct response to explicit user commands and their outcomes - never in a loop, never per-book (only the aggregate sync result) |
| Settings changes are saved | PASS | Every `KindleBridgeSettingTab` control's `onChange` calls `saveSettings()` |
| Settings restored after restart | PASS (code) / NOT TESTED (live) | `loadSettings()` reads via `loadData()` + `normalizeSettings()` in `onload()` |
| Manifest correct | **FIXED** | Was FAIL: `minAppVersion: "1.4.0"`, but the plugin calls `FileManager.processFrontMatter()`, which per Obsidian's own type declarations requires `@since 1.4.4`. A user on Obsidian 1.4.0-1.4.3 could have enabled the plugin and hit a runtime error on first sync. Fixed by bumping `manifest.json` and `versions.json` to `1.4.4` (the true maximum `@since` across every Obsidian API this plugin calls, individually verified) |
| Plugin ID is `obsidian-kindle-bridge` | PASS | Confirmed in `manifest.json` |
| Desktop-only flag correct | PASS | `isDesktopOnly: true`, consistent with the Electron `BrowserWindow` dependency |
| Minimum Obsidian version reasonable | **FIXED** | See "Manifest correct" above - now `1.4.4` |
| No sync blocking Obsidian startup | PASS | `onload()` only awaits `loadSettings()` (a data read); no auto-sync is triggered, matching the explicit MVP scope |
| No long UI-thread blocking during sync | PASS (reasoning) / NOT TESTED (at scale) | All I/O is `async`/`await`; cheerio parsing is synchronous but operates on already-fetched HTML and is expected to be fast (sub-second) for realistic page sizes. Not verified against a real, very large notebook page |

## Known Limitations

Unchanged from `docs/risks.md`/`docs/mvp-scope.md`, restated here for visibility:

- No deletion/diff detection, Daily Notes/Dataview integration, auto-sync, or
  additional Amazon regions (all explicitly deferred to Phase 4+ per the original
  scope, and this audit did not add any of them).
- Only the first page of a book's annotations is fetched (R-17) - heavily-annotated
  books beyond Amazon's per-page limit won't sync completely.
- HTTP 429 detection depends on an unverified Electron event signature assumption
  (R-16).
- The entire Electron-`BrowserWindow`-dependent code path (sign-in, session check,
  page fetch) has not been exercised against a real Obsidian install or real Amazon
  account (R-08) - this is the single biggest open question before genuine production
  use, and is why the recommendation below is scoped the way it is.

## Blocking Issues

**None remaining.** Two were found and fixed during this audit (see Obsidian API
Review): the `minAppVersion` mismatch and the unload timer leak. No other
Critical/High-severity issues were found in the repository audit, security review, or
Obsidian API review.

## Non-blocking Issues

- **Dead code (fixed)**: `isElectronRemoteAvailable()` (unused outside its own test)
  and `BookNoteRepository.describeTarget()` (unused and untested) were removed.
- **Dead code (kept, with justification)**: `SyncCoordinator.isSyncing()` is not
  called from `main.ts` production code paths (the lock's correctness is enforced
  internally regardless), but it is directly exercised by `SyncCoordinator.spec.ts` to
  verify lock state transitions before/during/after a sync, and is a reasonable,
  minimal public surface for a lock-like class. Judged worth keeping for
  testability/observability rather than removing to chase a zero-unused-exports
  metric. If a future phase wants to show sync-in-progress state in the UI, this
  method is already there and already tested.
- **Bundle weight**: cheerio's `undici` sub-dependency is bundled but never invoked
  (informational only, not a functional or security issue).
- **Design simplification, documented not hidden**: "Amazon未ログイン" and
  "セッション期限切れ" collapse into the same code path and the same user-facing
  message (`AmazonSessionExpiredError` / "your Amazon session has expired"), since
  `isSessionValid()` has no way to distinguish "never logged in" from "expired" given
  only a URL-redirect check. Functionally correct (the guidance - sign in again - is
  identical either way) but worth knowing if the wording is ever revisited.

## Manual Tests Required

Every `NOT TESTED` and `PARTIAL` row in the Completion Criteria table above requires a
real Obsidian + real Amazon account to verify. The full set of steps is in
`docs/manual-test-checklist.md` (7 sections, ~50 individual checks: Installation,
Settings, Authentication, Sync, Markdown, plus a Security spot-check pass). At minimum,
before trusting this plugin with a real Amazon account, run:

1. §1 (Installation) and §3.1 (Sign in) first, in isolation, to find out early whether
   the core Electron `BrowserWindow` login mechanism works at all in your Obsidian
   version - this is the single highest-uncertainty item (R-08).
2. §4.1-4.2 (first sync, re-sync) to confirm real book/annotation parsing against your
   actual Amazon account's real HTML (R-02) and non-duplicating re-sync behavior.
3. §5.15-5.16 (user-edited region preservation) since this is the core data-safety
   guarantee of the whole plugin.

## Recommendation

**READY FOR MANUAL ACCEPTANCE**

This means: the codebase has no known blocking code-level defects, all automated
checks pass from a clean install, and the implementation is ready for you to run
`docs/manual-test-checklist.md` against a real Obsidian install and a real Amazon
account. It does **not** mean the plugin has been confirmed to work end-to-end against
real Amazon - that confirmation can only come from completing the manual checklist,
since the Electron/Amazon-dependent code paths could not be exercised in this
environment. Please do not treat "READY FOR MANUAL ACCEPTANCE" as equivalent to
"verified working."
