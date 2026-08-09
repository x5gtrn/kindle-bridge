# Contributing to Kindle Bridge

Thanks for your interest in contributing. This document covers how to set up a development build and what's expected of a pull request.

## Prerequisites

- Node.js and npm.
- A Chrome, Edge, Chromium, or Brave browser installed, if you want to exercise sign-in/sync manually (see [README.md § Authentication](README.md#authentication)).
- An Obsidian vault you don't mind pointing a development build of a plugin at.
- An Amazon account, only if you intend to manually test sign-in/sync end-to-end. Not required to work on parsing, Markdown generation, or most unit-tested code.

## Clone and install

```bash
git clone <this-repository>
cd "Obsidian Kindle Bridge"
npm install
```

## Development build

```bash
npm run dev
```

This runs an esbuild watch build that rebuilds `main.js` on every save.

To try your build in a real vault, copy or symlink this repository folder into:

```
<your-vault>/.obsidian/plugins/kindle-bridge/
```

then enable "Kindle Bridge" under **Settings → Community plugins** in that vault, and reload the plugin (or restart Obsidian) after each rebuild.

## Test, lint, and typecheck

```bash
npm test            # vitest run
npm run test:watch  # vitest, watch mode
npm run lint         # eslint src
npm run lint:fix     # eslint src --fix
npm run typecheck    # tsc --noEmit
npm run format       # prettier --write
npm run format:check # prettier --check
```

## Production build

```bash
npm run build
```

Runs a typecheck followed by a minified, production esbuild build, producing `main.js` at the repository root (alongside `manifest.json`).

## Branch and PR expectations

- Open an issue first for anything beyond a small fix, so the approach can be discussed before you invest time.
- Keep pull requests focused — one logical change per PR.
- Make sure `npm run typecheck`, `npm run lint`, `npm test`, and `npm run build` all pass before opening a PR.
- Describe what you changed and why in the PR description; link the related issue if there is one.
- If your change is user-visible, update [README.md](README.md) and add a [CHANGELOG.md](CHANGELOG.md) entry under "Unreleased".

## Coding style

- TypeScript, strict types — avoid `any`; if you genuinely need an escape hatch, prefer a narrow, explicit type over `any` and explain why in a comment (see `src/main.ts`'s `CallableMoment`/`AppWithSettingTab` for examples).
- Prefer `const`/`let` over `var`, and `async`/`await` over raw Promise chains.
- Follow the existing module layout: `src/amazon/` (Amazon integration), `src/markdown/` (note generation/storage), `src/sync/` (orchestration), `src/settings/`, `src/ui/`, `src/utils/`.
- Run `npm run format` before committing; Prettier config is in `.prettierrc`.
- Follow the [Obsidian Plugin guidelines](https://docs.obsidian.md/Plugins/Releasing/Plugin+guidelines) for any UI or API-usage changes (sentence case in UI text, `this.app` not global `app`, `registerEvent`/`registerInterval` for cleanup, `FileManager.processFrontMatter` for frontmatter edits, no hardcoded default hotkeys, etc.).

## Tests and fixtures

- Unit tests live alongside their source file as `*.spec.ts`, run with Vitest.
- HTML fixtures for parser tests live in `src/tests/fixtures/`. **Never commit a real, personal Amazon HTML capture.** Fixtures must be hand-constructed or heavily anonymized/redacted so they contain no real book titles, author names, highlight/note text, account identifiers, or other personal data — structure (tag names, class names, attribute shapes) is what the parser tests actually need.
- If you're fixing a parser bug found against a real account, describe the structural change in your PR/commit message rather than pasting real captured HTML.

## Do not include personal data or credentials

- Never commit, paste into an issue/PR, or include in a fixture: your Amazon password, one-time code, cookies, session tokens, real highlight/note text, or other personal Kindle library data.
- Never commit real debug logs without reviewing them first, even though the logger masks known-sensitive keys (see [SECURITY.md](SECURITY.md)) — masking covers object keys it recognizes, not everything you might have typed into a log message yourself.

## Reporting security issues

Do not open a public issue for a security or privacy vulnerability — see [SECURITY.md](SECURITY.md) for how to report one privately.

## License

By contributing, you agree that your contributions will be licensed under this project's [MIT License](LICENSE).
