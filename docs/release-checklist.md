# Manual Release Acceptance Checklist — v1.0.0

Fill in `Expected` / `Actual` / `Status` / `Notes` for each item before publishing. `Status` is one of `PASS`, `FAIL`, `BLOCKED`, or `NOT TESTED`. Do not mark an item `PASS` without actually performing it — a manual step you haven't run yet should stay `NOT TESTED`, not be assumed.

For detailed step-by-step manual testing procedures (beyond this checklist's pass/fail rows), see [`docs/manual-test-checklist.md`](manual-test-checklist.md).

## Plugin

- [ ] Loads in Obsidian with no console error
  - Expected:
  - Actual:
  - Status:
  - Notes:
- [ ] Settings tab opens and renders all sections
  - Expected:
  - Actual:
  - Status:
  - Notes:
- [ ] All four commands are registered (Sign in to Amazon, Sync now, Sign out from Amazon, Open settings)
  - Expected:
  - Actual:
  - Status:
  - Notes:
- [ ] Ribbon icon triggers a sync
  - Expected:
  - Actual:
  - Status:
  - Notes:

## Authentication

- [ ] Japan sign-in
  - Expected:
  - Actual:
  - Status:
  - Notes:
- [ ] Global sign-in
  - Expected:
  - Actual:
  - Status:
  - Notes:
- [ ] MFA challenge during sign-in
  - Expected:
  - Actual:
  - Status:
  - Notes:
- [ ] Sign-out clears the session (subsequent sync prompts sign-in again)
  - Expected:
  - Actual:
  - Status:
  - Notes:
- [ ] Expired session is detected and surfaced clearly
  - Expected:
  - Actual:
  - Status:
  - Notes:

## Sync

- [ ] Initial sync creates notes for all annotated books
  - Expected:
  - Actual:
  - Status:
  - Notes:
- [ ] Second sync with no changes skips already-up-to-date books
  - Expected:
  - Actual:
  - Status:
  - Notes:
- [ ] A new highlight on Amazon appears on the next sync
  - Expected:
  - Actual:
  - Status:
  - Notes:
- [ ] A changed/removed highlight is reflected on the next sync
  - Expected:
  - Actual:
  - Status:
  - Notes:
- [ ] A book removed from the Kindle library is flagged, not deleted
  - Expected:
  - Actual:
  - Status:
  - Notes:
- [ ] A note (memo) attached to a highlight syncs correctly
  - Expected:
  - Actual:
  - Status:
  - Notes:
- [ ] Partial failure (one book errors) doesn't stop the rest of the sync
  - Expected:
  - Actual:
  - Status:
  - Notes:
- [ ] Offline / network-down behavior is a clear error, not a crash
  - Expected:
  - Actual:
  - Status:
  - Notes:

## Markdown

- [ ] Book note has correct frontmatter and generated block
  - Expected:
  - Actual:
  - Status:
  - Notes:
- [ ] Cover image displays and links to Amazon (when enabled)
  - Expected:
  - Actual:
  - Status:
  - Notes:
- [ ] Content outside the generated block (e.g. `## My Notes`) survives a re-sync
  - Expected:
  - Actual:
  - Status:
  - Notes:
- [ ] Daily Note summary line appends correctly when enabled
  - Expected:
  - Actual:
  - Status:
  - Notes:

## Automation

- [ ] Sync on startup runs once per launch and prompts sign-in if needed
  - Expected:
  - Actual:
  - Status:
  - Notes:
- [ ] Scheduled interval sync runs on the configured interval
  - Expected:
  - Actual:
  - Status:
  - Notes:

## Security

- [ ] No cookie value ever appears in the console, even with debug logging on
  - Expected:
  - Actual:
  - Status:
  - Notes:
- [ ] No password ever appears in the console
  - Expected:
  - Actual:
  - Status:
  - Notes:
- [ ] No token/session value ever appears in the console
  - Expected:
  - Actual:
  - Status:
  - Notes:
- [ ] No private highlight/note content appears in the console at any log level
  - Expected:
  - Actual:
  - Status:
  - Notes:

## Release

- [ ] `manifest.json` version is `1.0.0`
- [ ] `package.json` / `package-lock.json` version is `1.0.0`
- [ ] `versions.json` has a `1.0.0` entry with the correct `minAppVersion`
- [ ] `CHANGELOG.md` has a `[1.0.0]` entry
- [ ] `README.md` is accurate and contains no stale MVP/Phase language
- [ ] `LICENSE` is present and correct
- [ ] `PRIVACY.md` is present and matches actual behavior
- [ ] `SECURITY.md` is present
- [ ] GitHub Release for tag `1.0.0` has `main.js` and `manifest.json` attached (no `styles.css` — none is shipped)

## Sign-off

- Reviewed by:
- Date:
- Final status: READY FOR SUBMISSION / NOT READY (circle one)
