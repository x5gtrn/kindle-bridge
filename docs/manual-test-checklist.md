# Manual Test Checklist — Kindle Bridge MVP

This checklist covers everything the automated test suite (Vitest, 193 tests as of this
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

### 1.2 Plugin placement in the vault

**Steps:** Create (or locate) `<vault>/.obsidian/plugins/kindle-bridge/`. Copy `manifest.json`, `main.js`, and (if present) `styles.css` into it.

Expected result: The three files exist under that path in the test vault.
Actual result:
Status: PASS / FAIL / BLOCKED
Notes:

### 1.3 Enabling via Community Plugins

**Steps:** Open Obsidian → Settings → Community plugins. If needed, turn off Restricted Mode. Find "Kindle Bridge" in the installed list and enable it.

Expected result: The plugin appears in the list with the correct name and can be toggled on without an error dialog.
Actual result:
Status: PASS / FAIL / BLOCKED
Notes:

### 1.4 Console check

**Steps:** With the plugin enabled, open the Developer Console. Reload Obsidian (Cmd/Ctrl+R) or disable+re-enable the plugin.

Expected result: No uncaught exceptions or red error lines referencing `kindle-bridge` or `main.js` appear on load.
Actual result:
Status: PASS / FAIL / BLOCKED
Notes:

---

## 2. Settings

### 2.1 Selecting Japan

**Steps:** Open plugin settings. Set "Amazon region" to "Japan". Close and reopen the settings tab.

Expected result: "Japan" is shown as selected after reopening.
Actual result:
Status: PASS / FAIL / BLOCKED
Notes:

### 2.2 Selecting Global

**Steps:** Same as above, selecting "Global / United States".

Expected result: "Global / United States" is shown as selected after reopening.
Actual result:
Status: PASS / FAIL / BLOCKED
Notes:

### 2.3 Changing the output folder

**Steps:** Change "Output folder" to a custom path, e.g. `Reading/Kindle`. Run a sync (see section 4) afterward.

Expected result: Book notes are created under the new folder path, not the default `Highlight and Note/Books`.
Actual result:
Status: PASS / FAIL / BLOCKED
Notes:

### 2.4 Cover image display ON/OFF

**Steps:** Toggle "Display cover image" off, sync a book, then toggle it on and sync again (or sync a different book).

Expected result: With the toggle off, the generated note has no cover image markdown. With it on, the note includes `[![Book cover](...)](...)`.
Actual result:
Status: PASS / FAIL / BLOCKED
Notes:

### 2.5 Debug logging ON/OFF

**Steps:** Toggle "Debug logging" on. Open the Developer Console. Run a sync. Toggle it off and sync again.

Expected result: With it on, `[Kindle Bridge]`-prefixed debug-level log lines appear in the console during sync (e.g. login navigation events). With it off, only warn/error-level lines (if any) appear. In both cases, no password/cookie/session-token/highlight-text values appear in any log line (see section on security spot-checks below).
Actual result:
Status: PASS / FAIL / BLOCKED
Notes:

### 2.6 Settings persist after restart

**Steps:** Set region to Global, output folder to a custom value, all toggles to non-default values, and a custom Daily Note folder/date format. Fully quit and relaunch Obsidian (not just reload the window).

Expected result: All settings retain the values you set, after a full relaunch.
Actual result:
Status: PASS / FAIL / BLOCKED
Notes:

### 2.7 Daily Note summary settings - Phase 4

**Steps:** Enable "Daily Note summary". Set "Daily Note folder" and "Daily Note date format" to match your real Daily Notes plugin settings (Settings → Daily notes, if you use it).

Expected result: The three new fields (toggle, folder, date format) save and persist like any other setting; the description text under the toggle clearly states this plugin never creates the Daily Note and uses its own settings, not Obsidian's real Daily Notes configuration.
Actual result:
Status: PASS / FAIL / BLOCKED
Notes:

### 2.8 Automatic/interval sync settings - Phase 4

**Steps:** Open Settings. Confirm "Sync on startup", "Automatic interval sync" (both toggles), and "Sync interval (minutes)" (a slider) are present and save correctly. Try dragging the slider - confirm it only allows 15-360 in 15-minute steps (can't be set below 15 or above 360 from the UI).

Expected result: All three settings save/persist normally; the slider makes an invalid (too-short) interval impossible to select from the UI.
Actual result:
Status: PASS / FAIL / BLOCKED
Notes:

### 2.9 Additional region display - Phase 4 (selection only, not a real sync test)

**Steps:** Open the "Amazon region" dropdown. Confirm all 8 regions appear, with United Kingdom/Germany/France/Spain/Italy/Netherlands each labeled "(unverified)".

Expected result: All 8 options are selectable; the 6 new ones are visually distinguishable as unverified right in the dropdown, not just in docs. **Do not** attempt to actually sign in/sync against one of these regions unless you have a real account in that locale and are specifically trying to help verify it (see `docs/risks.md` R-20) - this step only confirms the dropdown itself, not real functionality.
Actual result:
Status: PASS / FAIL / BLOCKED
Notes:

### 2.10 Account section buttons (sign in / status / sync)

**Steps:** Open plugin settings. Confirm an "Account" section appears below "Amazon region", containing: a "Sign in to Amazon" button, a "Sign-in status" item with a "Check status" button, and a "Sync now" button. Click "Sign in" and confirm it behaves identically to running the "Kindle Bridge: Sign in to Amazon" command (same confirmation modal, same browser window flow - see §3.1). Click "Check status" and confirm the status text updates to reflect whether you're currently signed in for the selected region (a hidden browser window should open briefly while checking). Click "Sync now" and confirm it behaves identically to running "Kindle Bridge: Sync now" (see §4.1), including the completion Notice and `SyncProgressModal`.

Expected result: All three controls work exactly like their Command Palette equivalents; buttons disable themselves with a "Checking.../Syncing..." label while their operation is in flight and re-enable afterward; the status text reflects reality (matches what §3.4/§3.5 would show).
Actual result:
Status: PASS / FAIL / BLOCKED
Notes:

### 2.11 Sign-in status after sign-out

**Steps:** Following on from 2.10, run "Kindle Bridge: Sign out from Amazon" (Command Palette), then click "Check status" in settings again.

Expected result: Status text now reports not signed in (or session expired) for the selected region.
Actual result:
Status: PASS / FAIL / BLOCKED
Notes:

---

## 3. Authentication

### 3.1 Sign in

**Steps:** Run command "Kindle Bridge: Sign in to Amazon" (or the equivalent shown in the Command Palette - the displayed name will be prefixed with the plugin's full name, "Kindle Bridge"). Confirm the dialog, then complete Amazon's real login page in the window that opens.

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

### 3.7 Whether re-login is required after changing region

**Steps:** Sign in while region = Japan. Switch region to Global in settings. Run "Sync now".

Expected result: Since Amazon session partitions are shared per-plugin (not per-region) but Amazon itself tracks sessions per top-level domain (amazon.co.jp vs amazon.com are different login sessions), signing in on one region likely does **not** carry over to the other. Confirm whether sync fails with a session-invalid Notice (expected) and requires a fresh sign-in for the new region.
Actual result:
Status: PASS / FAIL / BLOCKED
Notes: _(This is a genuine open question our design didn't explicitly resolve - please record what actually happens.)_

---

## 4. Sync

### 4.1 First sync

**Steps:** With a valid session and at least one annotated book on Amazon, run "Sync now".

Expected result: A Notice reports counts (created/updated/errors), and a `SyncProgressModal` opens showing the full breakdown (books found, notes created/updated, highlights/notes fetched, skipped, already up to date, errors).
Actual result:
Status: PASS / FAIL / BLOCKED
Notes:

### 4.2 Re-sync

**Steps:** Immediately run "Sync now" again without changing anything on Amazon.

Expected result: Depends on the test book's `last_annotated_at` date (Phase 4, 2026-08-10 - see §4.18 for a dedicated test of this): if it's dated **today (UTC)**, the note is **updated** again (`notesUpdated` increments, `notesCreated` stays 0), with generated-block content equivalent (not duplicated) to before. If it's dated an **earlier day**, the second sync instead **skips** the book entirely without re-fetching it (`skippedUpToDate` increments, not `notesUpdated`) - this is the new incremental-sync behavior, not a bug. Either way, the note itself must be unchanged (not duplicated) after the second sync.
Actual result:
Status: PASS / FAIL / BLOCKED
Notes:

### 4.3 Multiple books

**Steps:** Ensure your Amazon account has 2+ annotated books, then sync.

Expected result: All books produce separate notes; `booksFound` matches the actual count.
Actual result:
Status: PASS / FAIL / BLOCKED
Notes:

### 4.4 A book with highlights only

**Steps:** Sync a book that has highlights but no notes attached.

Expected result: The note's generated block shows only `### Highlight` sections, no `**Note**` text; `note_count: 0` in frontmatter for that book.
Actual result:
Status: PASS / FAIL / BLOCKED
Notes:

### 4.5 A book with a note

**Steps:** Sync a book where at least one highlight has an attached note.

Expected result: That entry renders as `### Highlight with Note` with a `**Note**` section containing the note text.
Actual result:
Status: PASS / FAIL / BLOCKED
Notes:

### 4.6 Empty data (a book with zero annotations, if reachable)

**Steps:** Hard to force via the UI since Amazon's notebook normally only lists annotated books. If you can identify or contrive such a case, sync it - first when no note exists yet for that book, then again after deleting all its highlights/notes on Amazon when a note **does** already exist (e.g. sync it once with a highlight present, delete that highlight on Amazon, sync again).

Expected result: With no existing note, the book is counted in `skipped` and no note is created (unchanged from before Phase 4). With an existing note, the book is instead counted in `notesUpdated` and its generated block is replaced with a "_No highlights or notes found for this book on Amazon as of the last sync._" placeholder - not left showing the old, now-deleted content. See `docs/risks.md` R-13.
Actual result:
Status: PASS / FAIL / BLOCKED
Notes:

### 4.7 Network disconnect mid-sync

**Steps:** Start a sync with several books, then disable your network connection partway through.

Expected result: The books already fetched should complete normally; the interrupted book should be retried a bounded number of times then counted as an error, and the sync should still finish (not hang forever) unless the failure is classified as continuation-breaking.
Actual result:
Status: PASS / FAIL / BLOCKED
Notes:

### 4.8 Partial failure (some books fail)

**Steps:** If you can contrive a single-book failure (e.g., a book whose ASIN is unusual), sync a set including it.

Expected result: The failing book increments `errors`; other books still get created/updated notes; the sync completes rather than aborting.
Actual result:
Status: PASS / FAIL / BLOCKED
Notes:

### 4.9 Double-triggering sync

**Steps:** Click the ribbon icon (or run "Sync now") twice in quick succession, before the first finishes.

Expected result: The second attempt immediately shows a "a sync is already in progress" Notice and does not start a second concurrent sync.
Actual result:
Status: PASS / FAIL / BLOCKED
Notes:

### 4.10 A book removed from the Kindle library - Phase 4

**Steps:** Sync normally so a book gets a note. Then either archive/remove that book from your Kindle library on Amazon, or (safer for testing) temporarily rename it in a way that changes its ASIN visibility - whatever reliably makes it absent from the next `fetchBookListHtml()` result. Sync again.

Expected result: The book's existing note is **not** deleted and its highlights/notes are **not** removed - a warning banner (`> [!warning] This book no longer appears in your Kindle library`) is prepended inside the generated block, above the untouched existing content, and the note's frontmatter gains `kindle_bridge_missing_from_library: true`. The sync result modal shows a non-zero "Flagged as removed from library" count. Running sync again (book still missing) should **not** increase that count further (already flagged, not re-counted).
Actual result:
Status: PASS / FAIL / BLOCKED
Notes:

### 4.11 Missing-book flag self-heals on reappearance - Phase 4

**Steps:** Following on from 4.10, restore the book to your Kindle library (undo whatever made it disappear), then sync again.

Expected result: The book gets a normal `upsert()` this time - the warning banner is gone, `kindle_bridge_missing_from_library` is back to `false` in frontmatter, and the generated block reflects the book's real current highlights/notes.
Actual result:
Status: PASS / FAIL / BLOCKED
Notes:

### 4.12 Daily Note summary actually appends (Phase 4)

**Steps:** With "Daily Note summary" enabled (2.7) and its folder/date format matching a Daily Note you already have open/created for today, run a sync that creates or updates at least one book note. Then run "Sync now" again immediately with nothing changed on Amazon's side.

Expected result: After the first sync, a new line appears at the end of today's Daily Note, starting with "📚 Kindle Bridge:" and matching the sync's actual created/updated/flagged/highlight/note counts. After the second (no-op) sync, **no new line** is appended (zero meaningful activity).
Actual result:
Status: PASS / FAIL / BLOCKED
Notes:

### 4.13 When the Daily Note does not exist (Phase 4)

**Steps:** Make sure today's Daily Note does **not** exist yet (delete it if a previous test created one, or pick a date format that resolves to a nonexistent file). With "Daily Note summary" enabled, run a sync that creates/updates a note.

Expected result: The sync completes normally (Notice + modal as usual) and **no Daily Note file is created** - this plugin never creates it, only appends to an existing one. No error is shown to the user even though nothing was appended.
Actual result:
Status: PASS / FAIL / BLOCKED
Notes:

### 4.14 Sync on startup - Phase 4

**Steps:** Enable "Sync on startup" (2.8). Fully quit and relaunch Obsidian.

Expected result: A sync runs automatically shortly after Obsidian finishes loading - the completion Notice appears (e.g. "sync complete (...)"), but **no `SyncProgressModal` popup** (that's manual-sync-only, so it doesn't interrupt startup).
Actual result:
Status: PASS / FAIL / BLOCKED
Notes:

### 4.15 Interval sync - Phase 4

**Steps:** Enable "Automatic interval sync" with the interval slider at its minimum (15 minutes). Reload the plugin (or restart Obsidian) so the new interval is registered. Leave Obsidian open and wait.

Expected result: A sync runs automatically roughly every 15 minutes without any manual trigger, each showing the same completion Notice as 4.14 (no modal).
Actual result:
Status: PASS / FAIL / BLOCKED
Notes:

### 4.16 Silent failure on automatic sync - Phase 4

**Steps:** Sign out from Amazon (or otherwise let your session expire). With "Sync on startup" or interval sync enabled, trigger an automatic sync (restart Obsidian, or wait for the interval).

Expected result: **No error Notice appears** - the sync fails silently. Open the Developer Console with debug logging enabled (2.5) and confirm a log line describing the failure (e.g. "Automatic sync skipped - the Amazon session has expired." or "Automatic sync failed"). Then manually run "Sync now" with the same expired session and confirm it **does** show the usual error Notice - only automatically-triggered failures are silent.
Actual result:
Status: PASS / FAIL / BLOCKED
Notes:

### 4.17 Timing of interval-setting changes taking effect (Phase 4)

**Steps:** With interval sync already enabled and running, change "Sync interval (minutes)" to a different value without reloading the plugin.

Expected result: The change saves, but the **already-running interval keeps firing at the old value** until the plugin is reloaded or Obsidian is restarted - this is a documented limitation (see the setting's description text), not a bug.
Actual result:
Status: PASS / FAIL / BLOCKED
Notes:

### 4.18 Incremental sync skips a book not annotated since its last sync (Phase 4, 2026-08-10)

**Steps:** Pick a book whose `last_annotated_at` frontmatter (and Amazon's own book list) is dated an earlier day than today (UTC) - i.e. not annotated today. Sync it at least once so it has a note with `last_synced_at` set. Wait until the next UTC day has genuinely started (or just confirm today's date is already past the book's `last_annotated_at`), then run "Sync now" again.

Expected result: The `SyncProgressModal` shows a non-zero "Already up to date" count for this run, and `notesUpdated`/`highlightsFetched` do **not** increase for this book - its note content and `last_synced_at` are unchanged from before this run (a skipped book's `last_synced_at` is deliberately left untouched, not bumped to "now"). With debug logging on (§2.5), the console shows a "Skipping book ... - not annotated since its last sync" line for it.
Actual result:
Status: PASS / FAIL / BLOCKED
Notes:

### 4.19 Incremental sync still syncs a newly-annotated book (Phase 4, 2026-08-10)

**Steps:** Following on from 4.18, add a new highlight or note to that same book on Amazon (so its `last_annotated_at` becomes today's date), then run "Sync now" again.

Expected result: This time the book is **not** skipped - it's fetched and its note is updated normally (`notesUpdated` increments, `skippedUpToDate` does not count this book), reflecting the new highlight/note.
Actual result:
Status: PASS / FAIL / BLOCKED
Notes:

---

## 5. Markdown

For all of these, after syncing, open the resulting note(s) in Obsidian (both in Source Mode and Reading/Live Preview Mode where noted).

### 5.1 Book note creation

Expected result: One `.md` file per synced book exists under the configured output folder.
Actual result:
Status: PASS / FAIL / BLOCKED
Notes:

### 5.2 Properties (frontmatter)

**Steps:** Open a synced note and check its Properties panel (or raw frontmatter in Source Mode).

Expected result: `kindle_bridge: true`, `kindle_book_id`, `asin` (if available), `title`, `authors`, `amazon_region`, `amazon_url`, `cover_image_url`, `last_annotated_at`, `annotation_count`, `highlight_count`, `note_count`, `last_synced_at`, and `tags: [kindle, reading]` are all present and look correct for that book.
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

### 5.6 Note

Expected result: Notes you added on Amazon appear under a `**Note**` sub-section beneath their associated highlight.
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

### 5.10 Japanese title

**Steps:** Sync a Japan-region book with a Japanese title/author.

Expected result: The title/author render correctly (no mojibake), and the file name is a valid, readable Japanese file name.
Actual result:
Status: PASS / FAIL / BLOCKED
Notes:

### 5.11 English title

Expected result: Same as above for a Global-region English-titled book.
Actual result:
Status: PASS / FAIL / BLOCKED
Notes:

### 5.12 Long title

**Steps:** Sync a book with an unusually long title (100+ characters) if you have one.

Expected result: The file is created successfully with a truncated-but-still-readable file name (sanitizer caps at 150 characters); the full, untruncated title still appears correctly in the frontmatter `title` field and the `# Heading`.
Actual result:
Status: PASS / FAIL / BLOCKED
Notes:

### 5.13 Title with special characters

**Steps:** Sync a book whose title contains characters like `:`, `?`, `"`, `/`, or similar, if you have one.

Expected result: The file is created without error; illegal file-name characters are replaced (e.g. with `-`); the frontmatter `title` field preserves the original, unmodified title text.
Actual result:
Status: PASS / FAIL / BLOCKED
Notes:

### 5.14 Duplicate title

**Steps:** If two different books share an identical (or identically-sanitized) title, sync both.

Expected result: The second book's file name includes an ASIN/short-id suffix (e.g. `Title - B0XXXXXXXX.md`) instead of overwriting or colliding with the first.
Actual result:
Status: PASS / FAIL / BLOCKED
Notes:

### 5.15 User-edited region survives resync

**Steps:** Open a synced note. Add your own text under `## My Notes`, and also add a sentence somewhere between the frontmatter and `## Highlights and Notes` (e.g. right after the `# Title` heading). Save. Run "Sync now" again for the same book.

Expected result: Your added text in both locations is still present, character-for-character, after the resync.
Actual result:
Status: PASS / FAIL / BLOCKED
Notes:

### 5.16 Content outside the generated block survives

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
- [ ] Confirm no line contains the full text of one of your highlights or notes (short excerpts in error messages referencing a book *title* are expected and fine; full highlight/note bodies are not).
- [ ] Open `<vault>/.obsidian/plugins/kindle-bridge/data.json` in a text editor after signing in and syncing. Confirm it contains only the four settings fields (region, output folder, display toggle, debug toggle) - no cookies, tokens, or credentials.

---

## Summary

After completing this checklist, record the aggregate result:

- Total items: ____
- PASS: ____
- FAIL: ____
- BLOCKED: ____

List any FAIL items and file them as follow-up issues before considering the MVP accepted for real-world use.
