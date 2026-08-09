# Kindle Bridge

Sync your Kindle highlights and notes from Amazon into per-book Markdown notes in your Obsidian vault.

Kindle Bridge signs in to Amazon using Amazon's own official sign-in page, reads the same "notebook" pages you can already see yourself when signed in to Amazon in a browser, and generates one Markdown note per book with a clearly delimited, plugin-managed section for your highlights and notes. Everything else in the note is yours to edit freely.

Kindle Bridge is an independent community plugin. It is not affiliated with, endorsed by, or sponsored by Amazon or Obsidian. See [Authentication](#authentication) and [Amazon Dependency and Disclaimer](#amazon-dependency-and-disclaimer) below.

## Features

- **Kindle highlights sync** — fetches your highlights from Amazon's Kindle notebook pages.
- **Kindle notes sync** — fetches notes you've attached to a highlight, associated with the highlight they belong to.
- **Differential sync** — a book is only re-fetched when Amazon shows it was annotated since your last sync; unchanged books are skipped.
- **Deletion sync** — a highlight or note removed on Amazon's side disappears from the note on the next sync; a book removed from your Kindle library entirely is flagged with a non-destructive banner instead of being deleted.
- **Daily Notes integration** (opt-in) — appends a short sync summary line to today's Daily Note, if it already exists.
- **Scheduled sync** (opt-in) — sync automatically on Obsidian startup and/or on a fixed interval while Obsidian is open.
- **Manual sync** — trigger a sync from the Command Palette or the ribbon icon at any time.
- **Book cover links** — optionally shows the book cover in each note, linked to the Amazon URL. Covers are never downloaded or cached locally.
- **Settings** — Amazon region, output folder, cover image display, debug logging, Daily Note integration, and scheduled sync, all configurable from the settings tab.

## Screenshots

Screenshots are not yet included in this repository. Before publishing a release, add the following to a `screenshots/` folder and reference them here:

- Settings tab (all sections)
- Sign-in modal
- Sync progress / sync complete summary
- A generated book note (with the plugin-managed block visible)
- A Daily Note with an appended sync summary line

## Requirements

- **Obsidian** 1.4.4 or later.
- **Desktop only.** Kindle Bridge is not available on Obsidian Mobile (iOS/Android) — see [Authentication](#authentication) for why.
- **A Google Chrome, Microsoft Edge, Chromium, or Brave browser installed** on the machine running Obsidian. Kindle Bridge launches one of these as a separate process for sign-in, session checks, and page fetches. If none is found, these actions fail with a clear error.
- **An Amazon account** with Kindle books that have highlights or notes.

## Installation

### Community Plugins

Once Kindle Bridge is available in the Obsidian Community Plugins directory:

1. Open **Settings → Community plugins**.
2. Select **Browse** and search for "Kindle Bridge".
3. Select **Install**, then **Enable**.

### Manual installation

For development or testing before the plugin is published:

1. Run `npm install` and `npm run build` in this repository (see [CONTRIBUTING.md](CONTRIBUTING.md)).
2. Copy (or symlink) the repository folder into `<your-vault>/.obsidian/plugins/kindle-bridge/`, so that `main.js`, `manifest.json`, and (if present) `styles.css` are directly inside that folder.
3. Reload Obsidian, then enable Kindle Bridge under **Settings → Community plugins**.

## Getting Started

1. Install Kindle Bridge.
2. Open **Settings → Kindle Bridge**.
3. Choose your **Amazon region**.
4. Select **Sign in to Amazon** and complete sign-in in the browser window that opens.
5. Select **Sync now** (or run the "Kindle Bridge: Sync now" command, or use the ribbon icon).
6. Your book notes appear in the configured output folder (default `Highlight and Note/Books`).

## Authentication

- Kindle Bridge opens Amazon's **own, official sign-in page** in a real, separate browser window (Chrome, Edge, Chromium, or Brave — whichever is installed). It never displays a password or one-time-code field of its own.
- Kindle Bridge **does not read, store, or log your Amazon password, one-time code, or cookies**. They exist only inside that separate browser process's own profile directory, managed entirely by the browser itself.
- **Multi-factor authentication (MFA)** and **CAPTCHA** are handled entirely within Amazon's own page. Kindle Bridge does not detect, intercept, solve, or bypass either — you complete them exactly as you would in a normal browser.
- After you complete sign-in, Kindle Bridge detects success by observing that the browser navigated to the Kindle reader page for your selected region — it never inspects cookies or page content to do this.
- **Session**: sign-in state persists in a plugin-owned, persistent browser profile directory (see [Data Storage](#data-storage)) so you don't have to sign in before every sync. Session validity is checked before each sync by observing whether the notebook page redirects to a sign-in page.
- **Sign out**: the "Sign out from Amazon" command clears the browser profile's cookies for the selected region's domain.
- This is why Kindle Bridge is desktop-only and requires an installed Chromium-based browser: sign-in and page fetches are driven via the Chrome DevTools Protocol against a real, separate browser process, not an in-app login form.

## Supported Amazon Regions

| Region | Status |
|---|---|
| Japan (`amazon.co.jp`) | **Supported** — verified against a real account |
| Global / United States (`amazon.com`) | **Supported** — verified against a real account |
| United Kingdom (`amazon.co.uk`) | Experimental — registry scaffolding only, not verified against a real account |
| Germany (`amazon.de`) | Experimental — not verified against a real account |
| France (`amazon.fr`) | Experimental — not verified against a real account |
| Spain (`amazon.es`) | Experimental — not verified against a real account |
| Italy (`amazon.it`) | Experimental — not verified against a real account |
| Netherlands (`amazon.nl`) | Experimental — not verified against a real account |

Experimental regions are selectable in Settings (each one is labeled "(unverified)" there too) but their date parsing falls back to English and hasn't been checked against real Amazon markup in that locale. Book/highlight parsing is structure-based rather than language-based, so it's expected to work the same way, but this is unconfirmed. Please open an issue if you can verify (or report a problem with) one of these regions.

## Sync Behavior

- **First sync**: creates one Markdown note per book that has at least one highlight or note.
- **Subsequent syncs**: a book is skipped if Amazon hasn't shown it as annotated since your last sync of that book ([differential sync](#features)); otherwise its note's generated block is refreshed.
- **New or changed highlights/notes**: included in the refreshed generated block on the next sync that touches that book.
- **Deleted highlights/notes**: removed from Amazon simply don't appear in the next fetch, so they're dropped from the generated block. Nothing is diffed line-by-line; the whole generated block is regenerated from the current fetch each time.
- **Deleted books**: a book no longer in your Kindle library is flagged (a frontmatter key plus a banner prepended to the note) rather than deleted. The flag clears itself automatically if the book reappears in a later sync.
- **Managed vs. user-editable content**: each note has a generated block delimited by HTML comments (`<!-- kindle-bridge:generated:start -->` … `<!-- kindle-bridge:generated:end -->`). Only content **inside** these markers is ever overwritten by sync. A `## My Notes` section below the block (and anything else you add outside the markers) is never touched. If a note's markers are missing or edited away, that note is skipped on sync rather than risk overwriting your content.
- **Conflict behavior**: there's no merge logic — the generated block is fully replaced from the latest fetch each time. Content outside the block is exclusively yours.
- **Rate limiting**: requests to Amazon are spaced out and limited to a low concurrency. If Amazon responds with a rate-limit error (HTTP 429), the sync stops immediately (no retry) rather than continuing to hit Amazon; books already fetched before that point are still saved.

## Daily Notes Integration

Daily Notes integration is opt-in (off by default). When enabled, Kindle Bridge appends one summary line to **today's** Daily Note after a sync that created, updated, or flagged at least one note:

```
- 📚 Kindle Bridge: 2 created, 1 updated, 0 flagged as removed (14 highlights, 3 notes)
```

- Kindle Bridge **never creates** the Daily Note itself — it only appends if the file already exists.
- It uses its **own** "Daily Note folder" and "Daily Note date format" settings, not Obsidian's Daily Notes plugin configuration (there is no public API for reading that). Make sure your settings match your actual Daily Notes folder/format if you want the line to land in the right file.
- If appending fails for any reason (bad date format, missing folder, etc.), the failure is logged only — it never turns an otherwise-successful sync into a visible error.

## Scheduled Sync

Two independent, opt-in settings (both off by default):

- **Sync on startup**: runs a sync once, after Obsidian finishes loading. If you're not signed in or your session has expired, this opens the same sign-in prompt as the "Sign in to Amazon" command and, only if you complete it, chains into the sync — since this only happens once per launch, it doesn't fail silently.
- **Automatic interval sync**: runs a sync on a fixed interval (15–360 minutes) while Obsidian is open. Unlike startup sync, a failure here (not signed in, expired session, network error) is logged only, with no popup — this is deliberate, so an unattended interval sync doesn't interrupt you repeatedly.

Notes on behavior:
- Both settings take effect after reloading the plugin or restarting Obsidian, not immediately when toggled.
- If Obsidian is not running, no sync happens — there is no background service or system-level scheduler. Sync only runs while the Obsidian process with Kindle Bridge loaded is open.
- The interval timer is a standard in-app timer tied to Obsidian being open; it is not specifically tested across system sleep/wake cycles. If your computer sleeps through a scheduled tick, expect the next sync to happen at the next tick after wake, not immediately on wake.
- A manual "Sync now" always shows a result summary; an automatically-triggered sync shows a completion notice but not the detailed summary modal, to avoid interrupting your work.

## Generated Markdown

The following is an illustrative example — not real Kindle data. `## My Notes` and anything else outside the generated block is yours; Kindle Bridge never modifies it after the note's first creation.

```markdown
---
kindle_bridge: true
kindle_book_id: "B0EXAMPLE1"
asin: "B0EXAMPLE1"
title: "The Pragmatic Programmer"
authors:
  - "David Thomas"
  - "Andrew Hunt"
amazon_region: "global"
amazon_url: "https://www.amazon.com/dp/B0EXAMPLE1"
cover_image_url: "https://m.media-amazon.com/images/example.jpg"
last_annotated_at: "2026-08-01"
annotation_count: 2
highlight_count: 1
note_count: 1
last_synced_at: "2026-08-10T09:15:00.000Z"
tags:
  - kindle
  - reading
kindle_bridge_missing_from_library: false
---

# The Pragmatic Programmer

![cover](https://m.media-amazon.com/images/example.jpg)

By David Thomas, Andrew Hunt · [View on Amazon](https://www.amazon.com/dp/B0EXAMPLE1)

## Highlights and Notes

<!-- kindle-bridge:generated:start -->

<!-- kindle-bridge:annotation:id=abc123 -->
> Care about your craft.

<!-- kindle-bridge:annotation:id=def456 -->
> Think about your work.
>
> **Note:** revisit this chapter before starting a new project.

<!-- kindle-bridge:generated:end -->

## My Notes

Anything you write here (or below) is never touched by sync.
```

## Settings Reference

| Setting | Default | Description |
|---|---|---|
| Amazon region | Japan | Which Amazon Kindle store to sync from. See [Supported Amazon Regions](#supported-amazon-regions). |
| Sign in to Amazon | — | Opens the Amazon sign-in flow for the selected region. |
| Sign-in status | — | On-demand check (opens a brief hidden browser window) of whether your session is currently valid. |
| Sync now | — | Runs a sync immediately. |
| Output folder | `Highlight and Note/Books` | Vault folder where per-book notes are created. |
| Display cover image | On | Shows the book cover (linked to Amazon) in generated notes. |
| Debug logging | Off | Logs extra detail to the developer console. Credentials, cookies, and annotation text are always masked regardless of this setting. |
| Daily Note summary | Off | Appends a sync summary line to today's Daily Note, if it exists. |
| Daily Note folder | `Daily Notes` | Folder your Daily Notes live in. Must match your real Daily Notes setup for the summary to land in the right place. |
| Daily Note date format | `YYYY-MM-DD` | Moment.js format used for the Daily Note file name. |
| Sync on startup | Off | Sync once when Obsidian finishes loading. |
| Automatic interval sync | Off | Sync on a fixed interval while Obsidian is open. |
| Sync interval (minutes) | 60 (range 15–360) | Interval used when automatic interval sync is on. |

## Privacy

Kindle Bridge does not collect analytics or telemetry, and does not send your data to any developer-owned server. The only network destination is Amazon's own Kindle notebook pages for the region you select. Full details, including exactly what is stored and where: [PRIVACY.md](PRIVACY.md).

## Security

- Your Amazon password, one-time code, and cookies are never read, stored, or logged by Kindle Bridge — see [Authentication](#authentication).
- Sign-in happens on Amazon's real, official page in a real browser process, not an in-plugin form.
- Log messages are passed through a shared logger that masks object keys matching password/cookie/session/token/otp/auth/secret/credential before they reach the console, at every log level.
- Full details: [SECURITY.md](SECURITY.md).

## Data Storage

- **Markdown files**: one note per book, written to your configured output folder via Obsidian's Vault API.
- **Plugin settings** (region, folders, toggles, etc.): stored in this plugin's standard Obsidian `data.json`, like any other plugin's settings. Contains no Amazon credentials.
- **Sync metadata**: stored as frontmatter on each book's own note (e.g. `last_synced_at`, `last_annotated_at`), not in a separate database.
- **Browser profile**: a persistent, plugin-owned directory at `<vault>/.obsidian/plugins/kindle-bridge/browser-profile/`, created and managed by the external Chrome/Edge/Chromium/Brave process itself. This is where your Amazon session (cookies) actually lives — Kindle Bridge's own code never reads its contents. Signing out clears cookies in this profile for the current region.
- **Logs**: only to the developer console (View → Toggle Developer Tools), never to a file. Not persisted by Kindle Bridge.

## Troubleshooting

**Cannot sign in**
Make sure a supported browser (Chrome, Edge, Chromium, or Brave) is installed. If sign-in never completes, check the developer console for errors and confirm the browser window that opened isn't stuck behind another window.

**Session expired**
Run "Kindle Bridge: Sign in to Amazon" again. Sessions can expire the same way a normal browser session would.

**CAPTCHA**
Solve it in the sign-in browser window exactly as you would in a normal browser. Kindle Bridge does not detect or bypass CAPTCHA challenges.

**No books found**
Confirm you're signed in to the correct region (a book library on `amazon.com` won't show up if you're signed in to `amazon.co.jp`, for example) and that the account actually has Kindle books.

**No highlights or notes found for a book**
Confirm the book actually has highlights/notes visible on Amazon's own notebook page for that book. If it does but Kindle Bridge shows none, Amazon's page structure may have changed — see below.

**Region mismatch**
The Amazon region in Settings must match the region you're signed in to. Sign out and sign in again under the correct region if you switch.

**Sync failure**
Check the developer console with debug logging enabled (Settings → Debug logging). Error messages are designed to explain what failed (not signed in, network error, rate-limited, etc.) without exposing credentials.

**"Amazon's page structure may have changed" errors**
Kindle Bridge parses Amazon's own web pages, which Amazon can change at any time without notice (see [Amazon Dependency and Disclaimer](#amazon-dependency-and-disclaimer)). If parsing starts failing, please open an issue with the error message (never include cookies, tokens, or personal Kindle content — see [SECURITY.md](SECURITY.md)).

**Duplicated notes**
Kindle Bridge disambiguates by ASIN/book ID when two books would otherwise produce the same filename, and matches existing notes to books by frontmatter (`kindle_book_id`) rather than by filename alone. If you see true duplicates, please open an issue.

**Collecting logs for a bug report**
Enable "Debug logging" in Settings, reproduce the issue, then open the developer console (View → Toggle Developer Tools) and copy the `[Kindle Bridge]`-prefixed lines. Credentials and annotation text are masked automatically, but please still review before posting — see [SECURITY.md](SECURITY.md).

## Amazon Dependency and Disclaimer

Kindle Bridge is an independent community plugin and is not affiliated with, endorsed by, or sponsored by Amazon or Obsidian.

Kindle Bridge works by automating the same Kindle "notebook" web pages a signed-in user can already view in a browser. It does not use any official or public Amazon API, any private/reverse-engineered mobile API, or any credential-harvesting technique. Because of this:

- Amazon can change its page structure, login flow, or terms at any time without notice, which can break sync until the plugin is updated.
- CAPTCHA or other bot-detection may appear; Kindle Bridge does not attempt to bypass it.
- Behavior can differ by region, and most regions are unverified (see [Supported Amazon Regions](#supported-amazon-regions)).
- Automated access to your Amazon account may have implications under Amazon's Conditions of Use; use at your own discretion and risk.

## Contributing

Contributions are welcome — see [CONTRIBUTING.md](CONTRIBUTING.md) for how to set up a development build, run tests/lint/typecheck, and what to avoid (no personal Kindle data or credentials in commits, issues, or fixtures).

## License

MIT — see [LICENSE](LICENSE).

## Acknowledgements

The general idea of signing in via Amazon's own login page (so no credentials ever touch the plugin) and of protecting user-edited note content across re-syncs was informed by studying [hadynz/obsidian-kindle-plugin](https://github.com/hadynz/obsidian-kindle-plugin) (MIT licensed). No code from that project is reused in Kindle Bridge — this is an independent implementation with its own architecture, browser-automation approach, tests, and license. Thanks to its author and contributors for publishing a working reference.

## Project Docs

- [`docs/architecture.md`](docs/architecture.md) — component layout, region abstraction, auth/session design, extension points.
- [`docs/risks.md`](docs/risks.md) — known risks (Amazon HTML changes, session handling, MFA/CAPTCHA, etc.) and mitigations.
- [`docs/release-checklist.md`](docs/release-checklist.md) — manual release acceptance checklist.
- [`docs/community-plugin-submission.md`](docs/community-plugin-submission.md) — Community Plugin submission reference.
