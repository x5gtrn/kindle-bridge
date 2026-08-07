# Manual Test Checklist — Obsidian Kindle Bridge MVP

This checklist covers everything the automated test suite (Vitest, 156 tests as of this
writing) **cannot** verify: real Obsidian plugin loading, a real separate Chrome/Edge/
Chromium/Brave browser process driven via CDP, real Amazon login/MFA/CAPTCHA, real
network fetches, and real Markdown rendering inside Obsidian's editor. See
`docs/mvp-acceptance-report.md` for why each of these is unverified by automation.

Fill in **Actual result**, **Status**, and **Notes** for every item as you test. Do not
mark anything PASS based on assumption — if you didn't run the step, mark it `BLOCKED`
with a note on why.

## Prerequisites

- A real Obsidian desktop install (this plugin is desktop-only - `isDesktopOnly: true`).
- A dedicated **test vault** (not your main vault), so you can freely inspect/delete generated notes and `.obsidian/plugins` files.
- Node.js and npm (to build the plugin - see `README.md` Development section).
- A real Amazon account with Kindle purchases you have already highlighted/annotated (Japan and/or Global), for meaningful sync testing. Consider using a secondary/test Amazon account rather than your primary one, since this plugin's Amazon-facing code has not been live-verified before this checklist is run (see `docs/risks.md` R-05).
- An installed Chrome, Edge, Chromium, or Brave browser - sign-in, session checks, and page fetches all launch one of these as a separate process (see `docs/risks.md` R-05, R-08).
- Ability to open Obsidian's Developer Console (`Cmd+Option+I` on macOS, `Ctrl+Shift+I` on Windows/Linux) to check for errors and confirm no sensitive data is logged.

---

## 1. Installation

### 1.1 Build

**Steps:** From the project root, run `npm install` then `npm run build`.

Expected result: Both commands exit 0; `main.js` is created in the project root.
Actual result:
Status: PASS / FAIL / BLOCKED
Notes:

### 1.2 Vault へのPlugin配置

**Steps:** Create (or locate) `<vault>/.obsidian/plugins/obsidian-kindle-bridge/`. Copy `manifest.json`, `main.js`, and (if present) `styles.css` into it.

Expected result: The three files exist under that path in the test vault.
Actual result:
Status: PASS / FAIL / BLOCKED
Notes:

### 1.3 Community Plugins での有効化

**Steps:** Open Obsidian → Settings → Community plugins. If needed, turn off Restricted Mode. Find "Obsidian Kindle Bridge" in the installed list and enable it.

Expected result: The plugin appears in the list with the correct name and can be toggled on without an error dialog.
Actual result:
Status: PASS / FAIL / BLOCKED
Notes:

### 1.4 Console の確認

**Steps:** With the plugin enabled, open the Developer Console. Reload Obsidian (Cmd/Ctrl+R) or disable+re-enable the plugin.

Expected result: No uncaught exceptions or red error lines referencing `obsidian-kindle-bridge` or `main.js` appear on load.
Actual result:
Status: PASS / FAIL / BLOCKED
Notes:

---

## 2. Settings

### 2.1 Japan 選択

**Steps:** Open plugin settings. Set "Amazon region" to "Japan". Close and reopen the settings tab.

Expected result: "Japan" is shown as selected after reopening.
Actual result:
Status: PASS / FAIL / BLOCKED
Notes:

### 2.2 Global 選択

**Steps:** Same as above, selecting "Global / United States".

Expected result: "Global / United States" is shown as selected after reopening.
Actual result:
Status: PASS / FAIL / BLOCKED
Notes:

### 2.3 Output folder 変更

**Steps:** Change "Output folder" to a custom path, e.g. `Reading/Kindle`. Run a sync (see section 4) afterward.

Expected result: Book notes are created under the new folder path, not the default `Highlight and Memo/Books`.
Actual result:
Status: PASS / FAIL / BLOCKED
Notes:

### 2.4 Cover image 表示の ON/OFF

**Steps:** Toggle "Display cover image" off, sync a book, then toggle it on and sync again (or sync a different book).

Expected result: With the toggle off, the generated note has no cover image markdown. With it on, the note includes `[![Book cover](...)](...)`.
Actual result:
Status: PASS / FAIL / BLOCKED
Notes:

### 2.5 Debug logging の ON/OFF

**Steps:** Toggle "Debug logging" on. Open the Developer Console. Run a sync. Toggle it off and sync again.

Expected result: With it on, `[Kindle Bridge]`-prefixed debug-level log lines appear in the console during sync (e.g. login navigation events). With it off, only warn/error-level lines (if any) appear. In both cases, no password/cookie/session-token/highlight-text values appear in any log line (see section on security spot-checks below).
Actual result:
Status: PASS / FAIL / BLOCKED
Notes:

### 2.6 再起動後の設定保持

**Steps:** Set region to Global, output folder to a custom value, and both toggles to non-default values. Fully quit and relaunch Obsidian (not just reload the window).

Expected result: All four settings retain the values you set, after a full relaunch.
Actual result:
Status: PASS / FAIL / BLOCKED
Notes:

---

## 3. Authentication

### 3.1 Sign in

**Steps:** Run command "Kindle Bridge: Sign in to Amazon" (or the equivalent shown in the Command Palette - the displayed name will be prefixed with the plugin's full name, "Obsidian Kindle Bridge"). Confirm the dialog, then complete Amazon's real login page in the window that opens.

Expected result: A confirmation modal appears first (no email/password/OTP fields in it), followed by a Notice that a browser window is opening. A real, separate Chrome/Edge/Chromium/Brave window then opens showing Amazon's actual sign-in page. After successfully signing in and landing on the Kindle notebook/reader page, the window closes itself and a "signed in" Notice appears in Obsidian.
Actual result:
Status: PASS / FAIL / BLOCKED
Notes: _(This is the first live test of the CDP-based sign-in implemented 2026-08-07, replacing two earlier approaches - a separate `remote.BrowserWindow` and an embedded `<webview>` - that both failed for reasons outside this plugin's control; see `docs/risks.md` R-05 for the full history. Record here: which browser was found/launched, whether the window opened and was usable, and whether success detection fired correctly once you reached the notebook page. If no supported browser is installed, expect a clear `AmazonAuthUnsupportedError` Notice instead of a crash or silent failure.)_

### 3.2 MFA

**Steps:** If your Amazon account has MFA/2FA enabled, complete it during the sign-in flow above.

Expected result: The MFA challenge renders and behaves exactly as it would in a normal browser (this plugin does not intercept or special-case it). Login completes successfully afterward.
Actual result:
Status: PASS / FAIL / BLOCKED
Notes:

### 3.3 CAPTCHA

**Steps:** If Amazon presents a CAPTCHA during sign-in, solve it normally.

Expected result: The CAPTCHA renders and can be solved like in a normal browser. The plugin makes no attempt to detect, bypass, or auto-solve it. If you deliberately leave it unsolved for 5 minutes, the login attempt should time out with a clear Notice rather than hang indefinitely.
Actual result:
Status: PASS / FAIL / BLOCKED
Notes:

### 3.4 Session validity

**Steps:** After a successful sign-in, run "Kindle Bridge: Sync now" without having signed out.

Expected result: Sync proceeds past the session check (no "session expired" Notice) and begins fetching books.
Actual result:
Status: PASS / FAIL / BLOCKED
Notes:

### 3.5 Session expiration

**Steps:** This is hard to trigger on demand. Options: (a) wait for a natural Amazon session expiry, or (b) sign out of Amazon in a regular browser using the *same* underlying session if you know how to force-invalidate it, or (c) skip with BLOCKED if impractical.

Expected result: Running "Sync now" with an invalid/expired session shows a Notice guiding you to run "Sign in to Amazon" again, and does not attempt to fetch books.
Actual result:
Status: PASS / FAIL / BLOCKED
Notes:

### 3.6 Sign out

**Steps:** Run "Kindle Bridge: Sign out from Amazon".

Expected result: A "signed out" Notice appears. A subsequent "Sync now" should then behave like 3.5 (session invalid).
Actual result:
Status: PASS / FAIL / BLOCKED
Notes:

### 3.7 Region 変更後の再ログイン要否

**Steps:** Sign in while region = Japan. Switch region to Global in settings. Run "Sync now".

Expected result: Since Amazon session partitions are shared per-plugin (not per-region) but Amazon itself tracks sessions per top-level domain (amazon.co.jp vs amazon.com are different login sessions), signing in on one region likely does **not** carry over to the other. Confirm whether sync fails with a session-invalid Notice (expected) and requires a fresh sign-in for the new region.
Actual result:
Status: PASS / FAIL / BLOCKED
Notes: _(This is a genuine open question our design didn't explicitly resolve - please record what actually happens.)_

---

## 4. Sync

### 4.1 初回同期 (first sync)

**Steps:** With a valid session and at least one annotated book on Amazon, run "Sync now".

Expected result: A Notice reports counts (created/updated/errors), and a `SyncProgressModal` opens showing the full breakdown (books found, notes created/updated, highlights/memos fetched, skipped, errors).
Actual result:
Status: PASS / FAIL / BLOCKED
Notes:

### 4.2 再同期 (re-sync)

**Steps:** Immediately run "Sync now" again without changing anything on Amazon.

Expected result: The same book notes are **updated**, not duplicated - `notesUpdated` in the result should equal the book count from 4.1, `notesCreated` should be 0. Content inside the generated block should be equivalent (not duplicated) to before.
Actual result:
Status: PASS / FAIL / BLOCKED
Notes:

### 4.3 複数書籍 (multiple books)

**Steps:** Ensure your Amazon account has 2+ annotated books, then sync.

Expected result: All books produce separate notes; `booksFound` matches the actual count.
Actual result:
Status: PASS / FAIL / BLOCKED
Notes:

### 4.4 Highlight のみの書籍

**Steps:** Sync a book that has highlights but no memos/notes attached.

Expected result: The note's generated block shows only `### Highlight` sections, no `**Memo**` text; `memo_count: 0` in frontmatter for that book.
Actual result:
Status: PASS / FAIL / BLOCKED
Notes:

### 4.5 Memo ありの書籍

**Steps:** Sync a book where at least one highlight has an attached note.

Expected result: That entry renders as `### Highlight with Memo` with a `**Memo**` section containing the note text.
Actual result:
Status: PASS / FAIL / BLOCKED
Notes:

### 4.6 空データ (a book with zero annotations, if reachable)

**Steps:** Hard to force via the UI since Amazon's notebook normally only lists annotated books. If you can identify or contrive such a case, sync it.

Expected result: Per our design, a book with zero parsed annotations is counted in `skipped`, and no note is created for it.
Actual result:
Status: PASS / FAIL / BLOCKED
Notes:

### 4.7 通信切断 (network disconnect mid-sync)

**Steps:** Start a sync with several books, then disable your network connection partway through.

Expected result: The books already fetched should complete normally; the interrupted book should be retried a bounded number of times then counted as an error, and the sync should still finish (not hang forever) unless the failure is classified as continuation-breaking.
Actual result:
Status: PASS / FAIL / BLOCKED
Notes:

### 4.8 一部書籍の失敗 (partial failure)

**Steps:** If you can contrive a single-book failure (e.g., a book whose ASIN is unusual), sync a set including it.

Expected result: The failing book increments `errors`; other books still get created/updated notes; the sync completes rather than aborting.
Actual result:
Status: PASS / FAIL / BLOCKED
Notes:

### 4.9 同期の二重起動 (double-triggering sync)

**Steps:** Click the ribbon icon (or run "Sync now") twice in quick succession, before the first finishes.

Expected result: The second attempt immediately shows a "a sync is already in progress" Notice and does not start a second concurrent sync.
Actual result:
Status: PASS / FAIL / BLOCKED
Notes:

---

## 5. Markdown

For all of these, after syncing, open the resulting note(s) in Obsidian (both in Source Mode and Reading/Live Preview Mode where noted).

### 5.1 書籍ノート作成

Expected result: One `.md` file per synced book exists under the configured output folder.
Actual result:
Status: PASS / FAIL / BLOCKED
Notes:

### 5.2 Properties (frontmatter)

**Steps:** Open a synced note and check its Properties panel (or raw frontmatter in Source Mode).

Expected result: `kindle_bridge: true`, `kindle_book_id`, `asin` (if available), `title`, `authors`, `amazon_region`, `amazon_url`, `cover_image_url`, `last_annotated_at`, `annotation_count`, `highlight_count`, `memo_count`, `last_synced_at`, and `tags: [kindle, reading]` are all present and look correct for that book.
Actual result:
Status: PASS / FAIL / BLOCKED
Notes:

### 5.3 Cover image

**Steps:** Switch to Reading/Live Preview mode on a note whose book has a cover.

Expected result: The cover image actually loads and displays (fetched live from the Amazon-hosted URL - this plugin never downloads/caches it locally, so this also tests that the image URL Amazon gave us is actually valid and accessible).
Actual result:
Status: PASS / FAIL / BLOCKED
Notes:

### 5.4 Amazon link (click-through)

**Steps:** In Reading mode, click the cover image and separately click the "Open book page" link.

Expected result: Both open the book's Amazon product page (or Kindle Reader) in your default browser.
Actual result:
Status: PASS / FAIL / BLOCKED
Notes:

### 5.5 Highlight

Expected result: Highlighted passages appear as blockquoted text (`> ...`) under a `### Highlight` heading, matching what you see in Amazon's own notebook for that book.
Actual result:
Status: PASS / FAIL / BLOCKED
Notes:

### 5.6 Memo

Expected result: Notes/memos you added on Amazon appear under a `**Memo**` sub-section beneath their associated highlight.
Actual result:
Status: PASS / FAIL / BLOCKED
Notes:

### 5.7 Location

Expected result: A `- Location: <number>` line appears for annotations that have one, matching Amazon's own displayed location.
Actual result:
Status: PASS / FAIL / BLOCKED
Notes:

### 5.8 Page

Expected result: A `- Page: <number>` line appears where Amazon provides a page number.
Actual result:
Status: PASS / FAIL / BLOCKED
Notes:

### 5.9 Created date

Expected result: A `- Created: YYYY-MM-DD` line appears where Amazon exposes an annotation date; omitted where it doesn't (this is expected to be common - see `docs/risks.md` R-10).
Actual result:
Status: PASS / FAIL / BLOCKED
Notes:

### 5.10 日本語タイトル (Japanese title)

**Steps:** Sync a Japan-region book with a Japanese title/author.

Expected result: The title/author render correctly (no mojibake), and the file name is a valid, readable Japanese file name.
Actual result:
Status: PASS / FAIL / BLOCKED
Notes:

### 5.11 英語タイトル (English title)

Expected result: Same as above for a Global-region English-titled book.
Actual result:
Status: PASS / FAIL / BLOCKED
Notes:

### 5.12 長いタイトル (long title)

**Steps:** Sync a book with an unusually long title (100+ characters) if you have one.

Expected result: The file is created successfully with a truncated-but-still-readable file name (sanitizer caps at 150 characters); the full, untruncated title still appears correctly in the frontmatter `title` field and the `# Heading`.
Actual result:
Status: PASS / FAIL / BLOCKED
Notes:

### 5.13 特殊文字入りタイトル (title with special characters)

**Steps:** Sync a book whose title contains characters like `:`, `?`, `"`, `/`, or similar, if you have one.

Expected result: The file is created without error; illegal file-name characters are replaced (e.g. with `-`); the frontmatter `title` field preserves the original, unmodified title text.
Actual result:
Status: PASS / FAIL / BLOCKED
Notes:

### 5.14 同名書籍 (duplicate title)

**Steps:** If two different books share an identical (or identically-sanitized) title, sync both.

Expected result: The second book's file name includes an ASIN/short-id suffix (e.g. `Title - B0XXXXXXXX.md`) instead of overwriting or colliding with the first.
Actual result:
Status: PASS / FAIL / BLOCKED
Notes:

### 5.15 ユーザー編集領域の保持 (user-edited region survives resync)

**Steps:** Open a synced note. Add your own text under `## My Notes`, and also add a sentence somewhere between the frontmatter and `## Highlights and Memos` (e.g. right after the `# Title` heading). Save. Run "Sync now" again for the same book.

Expected result: Your added text in both locations is still present, character-for-character, after the resync.
Actual result:
Status: PASS / FAIL / BLOCKED
Notes:

### 5.16 管理ブロック外の保持 (content outside the generated block survives)

**Steps:** In the same note, also try lightly editing something *inside* the generated block region between the `<!-- kindle-bridge:generated:start -->` / `:end -->` comments (e.g. add a stray line), then resync.

Expected result: Content between the markers is fully replaced by fresh sync output (your edit inside that region does *not* survive - this is expected/by design, since only the region outside the markers is protected). Confirm this matches your expectation of the documented behavior, and that nothing *outside* the markers was touched.
Actual result:
Status: PASS / FAIL / BLOCKED
Notes:

---

## Security spot-checks (do alongside the above)

While performing the tests above, especially 2.5 (debug logging) and 3.1-3.6 (authentication), keep the Developer Console open and:

- [ ] Confirm no line in the console contains anything that looks like a raw cookie value, session token, or `Authorization:` header value.
- [ ] Confirm no line contains your Amazon password or an OTP code you typed.
- [ ] Confirm no line contains the full text of one of your highlights or memos (short excerpts in error messages referencing a book *title* are expected and fine; full highlight/memo bodies are not).
- [ ] Open `<vault>/.obsidian/plugins/obsidian-kindle-bridge/data.json` in a text editor after signing in and syncing. Confirm it contains only the four settings fields (region, output folder, display toggle, debug toggle) - no cookies, tokens, or credentials.

---

## Summary

After completing this checklist, record the aggregate result:

- Total items: ____
- PASS: ____
- FAIL: ____
- BLOCKED: ____

List any FAIL items and file them as follow-up issues before considering the MVP accepted for real-world use.
