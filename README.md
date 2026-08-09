# Kindle Bridge

Sync Kindle highlights and notes from your Amazon account into per-book Markdown notes in your Obsidian vault.

**Status:** Phase 0-3 MVP implemented and self-audited (manual sync, real Amazon parsing, Vault persistence; see [`docs/mvp-acceptance-report.md`](docs/mvp-acceptance-report.md)), **confirmed working end-to-end against a real Amazon account as of 2026-08-07**: sign-in (a separate Chrome/Edge/Chromium/Brave process driven via the Chrome DevTools Protocol - see [`docs/architecture.md`](docs/architecture.md) §4), session check, book list, per-book highlights/notes, and note creation in the vault have all been verified live. Phase 4 has since started: deletion/diff detection (`docs/risks.md` R-13) and an opt-in Daily Note sync summary (`docs/risks.md` R-18) were implemented 2026-08-07; opt-in automatic/scheduled sync (R-19), 6 additional (unverified) Amazon regions (R-20), and Community Plugin submission prep (R-21, see `docs/community-plugin-checklist.md`) followed on 2026-08-10. **Not yet published to the Obsidian Community Plugins directory** - the repo is submission-ready per the checklist above, but no GitHub Release or submission PR has been created. Still worth running [`docs/manual-test-checklist.md`](docs/manual-test-checklist.md) yourself before trusting it with your own vault, especially for scenarios not yet exercised live (e.g. the Global region, MFA/CAPTCHA, very large libraries, the new deletion-flagging behavior).

## What this is

- Signs in to Amazon using Amazon's **own official login page**, rendered in a real, separate browser window (Chrome, Edge, Chromium, or Brave - whichever is installed on your machine). This plugin never asks for, sees, or stores your Amazon email, password, or one-time code.
- Reads the Kindle "notebook" pages you can already see yourself when signed in to Amazon in a browser. **Japan** and **Global/United States** are confirmed working against real accounts; **UK/Germany/France/Spain/Italy/Netherlands** are also selectable but registry scaffolding only - not verified against any real account (see `docs/risks.md` R-20).
- Generates one Markdown note per book, with highlights and notes in a clearly delimited, plugin-managed section - everything else in the note is yours to edit freely and is never overwritten.
- Reflects deletions, non-destructively: a highlight/note removed on Amazon's side disappears from the note on the next sync; a book removed from your Kindle library entirely gets a visible warning banner (its last-known highlights are kept, never deleted) that clears itself automatically if the book reappears.
- Optionally appends a short sync summary line to today's Daily Note (disabled by default - see Settings). Never creates the Daily Note itself, only appends if it already exists.
- Manual sync from the Command Palette or a ribbon icon, plus optional automatic sync on Obsidian startup and/or on a fixed interval (both disabled by default - see Settings). An automatically-triggered sync fails silently (logged only, no error popup) if you're not signed in or your session has expired - a manually-triggered sync always shows you what happened.

This is an **unofficial, community project**, not affiliated with or endorsed by Amazon. It automates the same notebook pages a signed-in user can view in a browser; it does not use any private/reverse-engineered Amazon API, and it does not attempt to bypass CAPTCHA or Amazon's bot-detection. See [`docs/risks.md`](docs/risks.md) for details, including Amazon's own Conditions of Use.

## Using with Dataview

Kindle Bridge doesn't need any special integration to work with the [Dataview](https://github.com/blacksmithgu/obsidian-dataview) community plugin (installed separately) - every generated book note's frontmatter is plain, queryable data. Every note has:

| Field | Example | Notes |
|---|---|---|
| `kindle_bridge` | `true` | Always present - use this (or the `#kindle`/`#reading` tags) to filter to just Kindle Bridge notes |
| `kindle_book_id` | `"B012345678"` | Stable id (ASIN when available) |
| `asin` | `"B012345678"` | `null` if Amazon didn't expose one |
| `title`, `authors` | `"Deep Work"`, `["Cal Newport"]` | |
| `amazon_region` | `"jp"` | Matches the region id in Settings |
| `amazon_url`, `cover_image_url` | | `null` if unavailable |
| `last_annotated_at` | `"2026-08-06"` | From Amazon's book list page, not per-annotation (see `docs/risks.md` R-10) |
| `annotation_count`, `highlight_count`, `note_count` | `12`, `9`, `3` | |
| `last_synced_at` | ISO-8601 instant | Updated every sync, even if nothing changed |
| `kindle_bridge_missing_from_library` | `false` | `true` if the book was flagged as no longer in your Kindle library (see "What this is" above) |

A few example queries, using [DQL](https://blacksmithgu.github.io/obsidian-dataview/queries/query-types/) (put these in a code block with the `dataview` language tag in any note):

**All synced books, most recently synced first:**

````
```dataview
TABLE authors AS "Author", highlight_count AS "Highlights", note_count AS "Notes", last_synced_at AS "Last synced"
FROM ""
WHERE kindle_bridge
SORT last_synced_at DESC
```
````

**Your most-highlighted books:**

````
```dataview
TABLE highlight_count AS "Highlights", note_count AS "Notes"
FROM ""
WHERE kindle_bridge
SORT highlight_count DESC
LIMIT 10
```
````

**Books removed from your Kindle library** (flagged, but not deleted - see "What this is" above):

````
```dataview
TABLE amazon_region AS "Region", last_synced_at AS "Last synced"
FROM ""
WHERE kindle_bridge AND kindle_bridge_missing_from_library
```
````

**Synced in the last 7 days:**

````
```dataview
LIST last_synced_at
FROM ""
WHERE kindle_bridge AND date(last_synced_at) >= date(today) - dur(7 days)
SORT last_synced_at DESC
```
````

`FROM ""` searches the whole vault, so these work regardless of your configured output folder; swap in `FROM "Highlight and Note/Books"` (or your own folder) to scope a query to just Kindle Bridge notes if you keep other unrelated notes tagged `kindle`/`reading` too.

## MVP limitations (this milestone)

The following are **intentionally out of scope** for this milestone and planned for a later phase - see [`docs/mvp-scope.md`](docs/mvp-scope.md) for the full breakdown:

- No differential/incremental sync beyond regenerating the plugin-managed block (deletion detection is implemented - see "What this is" above - but there's no line-level diff view or change history).
- No Dataview-specific integration code (not needed - Dataview already queries any note's frontmatter directly, see "Using with Dataview" above). Daily Note summary is implemented (see "What this is" above) but uses its own folder/date-format settings rather than reading Obsidian's real Daily Notes configuration, since no official API exists for that (see `docs/risks.md` R-18) - make sure they match if you want the summary in the same file your Daily Notes command opens.
- Only Japan and Global/United States are confirmed working - the other 6 regions in the dropdown are unverified (see "What this is" above and `docs/risks.md` R-20).
- No advanced cancellation UI beyond preventing overlapping syncs.
- Only the first page of a book's highlights/notes is fetched - very heavily annotated books beyond Amazon's per-page limit won't sync everything (see `docs/risks.md` R-17).
- No per-annotation page number or creation date in generated notes - confirmed 2026-08-07 that Amazon's current notebook page doesn't expose either anywhere in the page HTML (see `docs/risks.md` R-10). Highlight/note text and location are unaffected.
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

To try the plugin in a vault, symlink or copy this folder (after `npm run build`) into `<vault>/.obsidian/plugins/kindle-bridge/`, then enable it in Obsidian's Community Plugins settings.

## Project docs

- [`docs/architecture.md`](docs/architecture.md) - component layout, region abstraction, auth/session design, extension points.
- [`docs/risks.md`](docs/risks.md) - known risks (Amazon HTML changes, session handling, MFA/CAPTCHA, etc.) and mitigations.
- [`docs/mvp-scope.md`](docs/mvp-scope.md) - explicit in-scope/out-of-scope list for this milestone.
- [`docs/mvp-acceptance-report.md`](docs/mvp-acceptance-report.md) - self-audit of the Phase 0-3 implementation: repository/security/Obsidian-API review, completion-criteria table, what's automatically verified vs. not.
- [`docs/manual-test-checklist.md`](docs/manual-test-checklist.md) - step-by-step manual tests to run against a real Obsidian install and Amazon account before trusting this plugin with your data.
- [`docs/community-plugin-checklist.md`](docs/community-plugin-checklist.md) - Community Plugin submission-readiness audit and the remaining manual steps to actually publish.

## Acknowledgements

The general idea of Amazon sign-in (Amazon's own login page, so no credentials ever touch this plugin) and of protecting user-edited note content across re-syncs was informed by studying [hadynz/obsidian-kindle-plugin](https://github.com/hadynz/obsidian-kindle-plugin) (MIT licensed). No code from that project is reused in Kindle Bridge; this is an independent implementation with its own architecture (including its own browser-automation approach - see `docs/risks.md` R-05), tests, and license. Thank you to its author and contributors for publishing a working reference.

## License

MIT - see [`LICENSE`](LICENSE).
