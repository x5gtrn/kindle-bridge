# Obsidian Kindle Bridge

Sync Kindle highlights and memos from your Amazon account into per-book Markdown notes in your Obsidian vault.

**Status:** early development (Phase 0-3 MVP). Not yet published to the Obsidian Community Plugins directory.

## What this is

- Signs in to Amazon using Amazon's **own official login page**, rendered in a separate window. This plugin never asks for, sees, or stores your Amazon email, password, or one-time code.
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
- Not submitted to the Community Plugins directory yet.
- **Desktop only.** This plugin relies on Electron APIs available in Obsidian's desktop app and does not work on Obsidian Mobile (iOS/Android).

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

## Acknowledgements

The design of Amazon sign-in (Amazon's own login page rendered in a persistent Electron session, so no credentials ever touch this plugin) and of protecting user-edited note content across re-syncs was informed by studying [hadynz/obsidian-kindle-plugin](https://github.com/hadynz/obsidian-kindle-plugin) (MIT licensed). No code from that project is reused in Obsidian Kindle Bridge; this is an independent implementation with its own architecture, tests, and license. Thank you to its author and contributors for publishing a working reference.

## License

MIT - see [`LICENSE`](LICENSE).
