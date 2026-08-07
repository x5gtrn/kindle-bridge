# Obsidian Kindle Bridge

Sync Kindle highlights and memos from your Amazon account into per-book Markdown notes in your Obsidian vault.

**Status:** Phase 0-3 MVP implemented and self-audited (manual sync, real Amazon parsing, Vault persistence; see [`docs/mvp-acceptance-report.md`](docs/mvp-acceptance-report.md)). Not yet published to the Obsidian Community Plugins directory. Sign-in (a separate Chrome/Edge/Chromium/Brave process driven via the Chrome DevTools Protocol - see [`docs/architecture.md`](docs/architecture.md) §4) has been **confirmed working end-to-end against a real Amazon account** as of 2026-08-07. Live testing that same day also found and fixed two real bugs in the sync path itself - an unbounded wait that could hang a sync indefinitely, and annotation-parsing selectors that no longer matched Amazon's current page at all (see [`docs/risks.md`](docs/risks.md) R-02, R-05) - both fixed, but full end-to-end note creation against a real account is still pending final re-confirmation. Run [`docs/manual-test-checklist.md`](docs/manual-test-checklist.md) before relying on this for your own data.

## What this is

- Signs in to Amazon using Amazon's **own official login page**, rendered in a real, separate browser window (Chrome, Edge, Chromium, or Brave - whichever is installed on your machine). This plugin never asks for, sees, or stores your Amazon email, password, or one-time code.
- Reads the Kindle "notebook" pages you can already see yourself when signed in to Amazon in a browser, for **Japan** and **Global/United States** accounts.
- Generates one Markdown note per book, with highlights and memos in a clearly delimited, plugin-managed section - everything else in the note is yours to edit freely and is never overwritten.
- Manual sync only, triggered from the Command Palette or a ribbon icon.

This is an **unofficial, community project**, not affiliated with or endorsed by Amazon. It automates the same notebook pages a signed-in user can view in a browser; it does not use any private/reverse-engineered Amazon API, and it does not attempt to bypass CAPTCHA or Amazon's bot-detection. See [`docs/risks.md`](docs/risks.md) for details, including Amazon's own Conditions of Use.

## MVP limitations (this milestone)

The following are **intentionally out of scope** for this milestone and planned for a later phase - see [`docs/mvp-scope.md`](docs/mvp-scope.md) for the full breakdown:

- No detection/removal of highlights or memos deleted on Amazon's side.
- No differential/incremental sync beyond regenerating the plugin-managed block.
- No Daily Notes or Dataview integration.
- No automatic sync on startup or on a schedule - sync is always manual.
- Only Japan and Global/United States Amazon regions (a region registry makes adding more low-effort later, but no other regions ship in this milestone).
- No advanced cancellation UI beyond preventing overlapping syncs.
- Only the first page of a book's highlights/memos is fetched - very heavily annotated books beyond Amazon's per-page limit won't sync everything (see `docs/risks.md` R-17).
- No per-annotation page number or creation date in generated notes - confirmed 2026-08-07 that Amazon's current notebook page doesn't expose either anywhere in the page HTML (see `docs/risks.md` R-10). Highlight/memo text and location are unaffected.
- Not submitted to the Community Plugins directory yet.
- **Desktop only.** This plugin relies on launching a separate browser process and does not work on Obsidian Mobile (iOS/Android).
- **Requires an installed Chrome, Edge, Chromium, or Brave browser** on the machine running Obsidian - sign-in, session checks, and page fetches all launch one of these as a separate process. If none is found, these actions fail with a clear error instead of silently doing nothing.

## Development

Requirements: Node.js and npm.

```bash
npm install
npm run dev        # esbuild watch build -> main.js
npm run build      # typecheck + production build
npm run typecheck  # tsc --noEmit
npm run lint        # eslint src
npm test            # vitest run
```

To try the plugin in a vault, symlink or copy this folder (after `npm run build`) into `<vault>/.obsidian/plugins/obsidian-kindle-bridge/`, then enable it in Obsidian's Community Plugins settings.

## Project docs

- [`docs/architecture.md`](docs/architecture.md) - component layout, region abstraction, auth/session design, extension points.
- [`docs/risks.md`](docs/risks.md) - known risks (Amazon HTML changes, session handling, MFA/CAPTCHA, etc.) and mitigations.
- [`docs/mvp-scope.md`](docs/mvp-scope.md) - explicit in-scope/out-of-scope list for this milestone.
- [`docs/mvp-acceptance-report.md`](docs/mvp-acceptance-report.md) - self-audit of the Phase 0-3 implementation: repository/security/Obsidian-API review, completion-criteria table, what's automatically verified vs. not.
- [`docs/manual-test-checklist.md`](docs/manual-test-checklist.md) - step-by-step manual tests to run against a real Obsidian install and Amazon account before trusting this plugin with your data.

## Acknowledgements

The general idea of Amazon sign-in (Amazon's own login page, so no credentials ever touch this plugin) and of protecting user-edited note content across re-syncs was informed by studying [hadynz/obsidian-kindle-plugin](https://github.com/hadynz/obsidian-kindle-plugin) (MIT licensed). No code from that project is reused in Obsidian Kindle Bridge; this is an independent implementation with its own architecture (including its own browser-automation approach - see `docs/risks.md` R-05), tests, and license. Thank you to its author and contributors for publishing a working reference.

## License

MIT - see [`LICENSE`](LICENSE).
