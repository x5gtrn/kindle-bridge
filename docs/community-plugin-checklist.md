# Community Plugin submission checklist

Prep work done 2026-08-10 against Obsidian's current, live-fetched submission requirements (`docs.obsidian.md` "Plugin guidelines", "Submission requirements for plugins", and the GitHub Actions release doc - not relying on possibly-stale training knowledge). See `docs/risks.md` R-21 for the residual-risk framing of the two documented trade-offs below.

**This document only prepares the repository. It does not submit anything.** No GitHub Release, tag, or pull request to `obsidianmd/obsidian-releases` has been created as part of this work - those are real, public, hard-to-reverse actions the maintainer takes deliberately, listed as manual steps at the end of this file.

## Fixed for compliance

- **Plugin id/name could not contain "Obsidian" or "Plugin"** (confirmed both by the official guide - "No 'obsidian' or 'plugin' in the ID" - and by real precedent: `phibr0/obsidian-charts` and `javalent/obsidian-leaflet` were both required to rename for this exact reason). `manifest.json`'s `id` changed from `obsidian-kindle-bridge` to `kindle-bridge`, `name` from "Obsidian Kindle Bridge" to "Kindle Bridge". Propagated to `package.json` and every doc reference. **Consequence**: any existing local test install must move from `.obsidian/plugins/obsidian-kindle-bridge/` to `.obsidian/plugins/kindle-bridge/` and sign in to Amazon again (the browser profile directory is keyed by `manifest.id` - see `docs/architecture.md` §4).

## Verified compliant (checked, not skipped)

Audited against the fetched "Plugin guidelines" checklist via `grep` across `src/`:

- No `innerHTML`/`outerHTML`/`insertAdjacentHTML` used for this plugin's own UI. (One `outerHTML` match exists in `src/amazon/cdp/CdpBrowser.ts`, but it's a JavaScript string literal evaluated *inside* the separate CDP-driven browser process to read Amazon's own page - not Obsidian DOM construction. A different context, not a violation.)
- No inline `.style.` property assignments.
- No bare `window.app`/global `app` access - `this.app` used throughout.
- No `var` declarations.
- No raw `console.*` calls outside `Logger`'s own `defaultSink` (`src/utils/logger.ts`) - every log line goes through the shared, credential-masking `Logger`.
- No default hotkeys set on any `addCommand()` call.
- Settings tab (`KindleBridgeSettingTab`) uses sentence-case names, never the word "settings" in a heading, and no top-level heading elements (the `h2` titles in `LoginModal`/`SyncProgressModal` are dialog titles, a different, expected context from settings-tab section headings).
- `Vault`/`FileManager` APIs used throughout for all vault content; the one place this plugin does use Node's `fs`/`child_process` directly (`main.ts`'s `getProfileDir()`, `src/amazon/cdp/`) is for the browser process/profile directory, not vault content - documented in `docs/architecture.md` §4.
- `isDesktopOnly: true` is set, which is what permits this plugin's Node/Electron API usage (otherwise disallowed for mobile compatibility, per the guidelines' "Mobile" section).

## Documented trade-offs (reviewed, not changed)

- **`joinVaultPath()` instead of Obsidian's real `normalizePath()`** (`src/utils/vaultPath.ts`): a hand-rolled stand-in, chosen specifically so `BookNoteRepository`/`DailyNoteAppender` stay unit-testable under Vitest (`normalizePath` is a runtime-only value from the types-only `obsidian` package - the same class of issue as `moment`, see `docs/architecture.md` §7/§8). Low real risk since inputs are the plugin's own settings values, not arbitrary external input.
- **Default `Logger` level is `"info"`, not error-only**, even with the `debugLogging` setting off - more verbose than the guideline's "avoid unnecessary logging; console should only show errors by default" suggestion. This was a deliberate choice made earlier at the user's own explicit request, specifically to make live sync progress/hangs debuggable after several rounds of live-testing sessions where visibility was the actual blocker. A soft/subjective guideline, not a hard rejection criterion like the id/name rule - not changed unilaterally, since doing so would undo something explicitly asked for. Worth expecting a reviewer comment on this specifically.

## Left for the maintainer

- `manifest.json`'s `authorUrl` is currently `""`. Optional field - fill in if desired (e.g. a GitHub profile URL). Not guessed/filled in automatically.
- `manifest.json`'s `fundingUrl` is not set (optional, e.g. GitHub Sponsors/Buy Me a Coffee - add only if you want it).

## Remaining manual steps to actually publish (not done here)

1. Decide on a real `1.0.0`-style version (currently `0.1.0`) and update `manifest.json`/`versions.json` together if desired.
2. `git tag -a <version> -m "<version>"` (no `v` prefix) and `git push origin <version>` - this triggers `.github/workflows/release.yml` (added in this pass), which builds and creates a **draft** GitHub Release with `main.js`/`manifest.json` attached.
3. Review and publish that draft release (add release notes) from the repository's Releases page.
4. Fork `obsidianmd/obsidian-releases`.
5. Add an entry to the end of `community-plugins.json`: `{"id": "kindle-bridge", "repo": "<your-github-username>/<repo-name>"}`.
6. Open a pull request to `obsidianmd/obsidian-releases` and complete their PR checklist template.
7. Respond to any reviewer feedback (the two documented trade-offs above are likely discussion points).
