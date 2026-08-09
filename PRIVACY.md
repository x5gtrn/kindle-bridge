# Privacy Policy — Kindle Bridge

This document describes exactly what Kindle Bridge does and does not do with your data. It is written to match the current implementation; if you find a discrepancy between this document and the plugin's actual behavior, please open an issue.

## Summary

Kindle Bridge does not collect analytics or telemetry. It does not send your data to any developer-owned server. The only network communication it performs is with Amazon's own Kindle web pages, for the Amazon region you select.

## What Kindle Bridge sends over the network

- **Amazon only.** Kindle Bridge's sign-in, session-check, and sync operations all talk exclusively to Amazon's own domains (e.g. `read.amazon.co.jp`, `read.amazon.com`, and the equivalent domains for other selectable regions). See [README.md § Supported Amazon Regions](README.md#supported-amazon-regions).
- **Cover images**, if "Display cover image" is enabled, are referenced by their Amazon-hosted URL and loaded by Obsidian when you view the note — Kindle Bridge does not download, proxy, or cache them itself.
- **No developer-owned or third-party server.** Kindle Bridge does not have a backend, and does not send data anywhere other than Amazon.
- **Local-only communication**: the plugin's code talks to a separate browser process it launches (Chrome, Edge, Chromium, or Brave) over a local Chrome DevTools Protocol WebSocket on `127.0.0.1`. This connection never leaves your machine.

## Telemetry and analytics

Kindle Bridge does not collect analytics, telemetry, crash reports, or usage statistics of any kind. There is no client-side or server-side tracking.

## Authentication and credentials

- Kindle Bridge never displays its own password or one-time-code entry field. Sign-in happens entirely on Amazon's real, official page, rendered in a real, separate browser window.
- Kindle Bridge does not read, transmit, or store your Amazon email, password, or one-time authentication code, at any point.
- See [README.md § Authentication](README.md#authentication) and [SECURITY.md](SECURITY.md) for the technical details of how sign-in works.

## Cookies and session data

- Your Amazon session cookies are created and held exclusively by the separate browser process (Chrome/Edge/Chromium/Brave), inside its own persistent profile directory. See [Data Storage](#data-storage) below for where that directory lives.
- Kindle Bridge's own code does not read, parse, copy, export, or log cookie values.
- Signing out clears cookies for the current region within that browser profile.

## Kindle book metadata, highlights, and notes

- Book metadata (title, authors, ASIN, cover URL, Amazon URL, annotation counts, dates) and the highlights/notes themselves are read from Amazon's notebook pages and written **only** to Markdown files inside your own Obsidian vault, as frontmatter and note content.
- This content is never sent anywhere other than into your local vault. It is not uploaded, synced to a cloud service by the plugin, or shared with any third party.
- Full highlight/note text is never written to logs, at any log level (see [Logs](#logs) below).

## Generated Markdown

The Markdown notes Kindle Bridge creates live in your vault like any other note. Their storage, sync (e.g. via Obsidian Sync or a third-party sync plugin you've installed), and backup are entirely governed by your own vault configuration — Kindle Bridge has no role in that beyond creating and updating the files.

## Local storage

- **Plugin settings** (Amazon region, output folder, toggles, sync interval, etc.) are stored in this plugin's standard Obsidian `data.json`, the same mechanism any Obsidian plugin uses for its settings. This file contains no Amazon credentials or cookies.
- **Sync metadata** (e.g. `last_synced_at`, `last_annotated_at`) is stored as frontmatter directly on each book's note — there is no separate hidden database.
- **Browser profile directory**: a persistent folder at `<vault>/.obsidian/plugins/kindle-bridge/browser-profile/`, created and managed by the external browser process itself. This is where your Amazon session actually lives. Kindle Bridge's own code treats this directory as opaque — it does not read its contents, only points the browser at it.

## Logs

- Kindle Bridge logs to the Obsidian developer console only (View → Toggle Developer Tools). It never writes logs to a file.
- All log calls go through a shared logger that masks any object field whose key matches `password`, `cookie`, `session`, `token`, `otp`, `auth`, `secret`, or `credential` (case-insensitive), replacing the value with `[redacted]`, at every log level — including when "Debug logging" is enabled.
- Full Amazon response bodies and full highlight/note text are never passed to the logger.

## Third-party services

Kindle Bridge does not integrate with, or send data to, any third-party service other than Amazon itself. It does not use any analytics SDK, crash-reporting SDK, or advertising network.

## Data retention and deletion

- All data Kindle Bridge stores (settings, sync metadata, generated notes, the browser profile) is stored locally on your machine, under your vault or this plugin's own data directory.
- To remove everything Kindle Bridge has stored: disable and remove the plugin, delete the generated notes from your vault (or leave them — they're plain Markdown you own), and delete the plugin's data folder (`<vault>/.obsidian/plugins/kindle-bridge/`), which also removes the browser profile and its cookies.

## Changes to this policy

If Kindle Bridge's behavior changes in a way that affects this policy, this document will be updated in the same release, and the change will be noted in [CHANGELOG.md](CHANGELOG.md).
