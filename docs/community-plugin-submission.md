# Community Plugin Submission Reference

This document was prepared by fetching Obsidian's current developer documentation directly (not from prior/training knowledge) on 2026-08-10, from `obsidianmd/obsidian-developer-docs` and `obsidianmd/obsidian-releases` on GitHub:

- [Submit your plugin](https://docs.obsidian.md/Plugins/Releasing/Submit+your+plugin)
- [Submission requirements for plugins](https://docs.obsidian.md/Plugins/Releasing/Submission+requirements+for+plugins)
- [Plugin guidelines](https://docs.obsidian.md/Plugins/Releasing/Plugin+guidelines)
- [Developer policies](https://docs.obsidian.md/Developer+policies)
- [Manifest reference](https://docs.obsidian.md/Reference/Manifest)
- [versions.json reference](https://docs.obsidian.md/Reference/Versions)
- [Release your plugin with GitHub Actions](https://docs.obsidian.md/Plugins/Releasing/Release+your+plugin+with+GitHub+Actions)
- `obsidianmd/obsidian-releases`' `community-plugins.json` (current schema) and `README.md`

**Important, and different from older/cached knowledge of this process**: plugin submission is no longer done by opening a pull request against `community-plugins.json` yourself. It's done through a web form at [community.obsidian.md](https://community.obsidian.md) after connecting your GitHub account. Obsidian's own systems add the `community-plugins.json` entry for you once you submit.

## Plugin identity

| Field | Value |
|---|---|
| Plugin ID | `kindle-bridge` |
| Plugin name | Kindle Bridge |
| Author | Daisuke Masuda |
| Description | Sync Kindle highlights and notes from Amazon into per-book Markdown notes in your vault. |
| Repository | `https://github.com/x5gtrn/kindle-bridge` |
| Current version | 1.0.2 |
| minAppVersion | 1.4.4 |
| isDesktopOnly | true |
| License | MIT |

Both the plugin ID and name comply with the current rules: no "obsidian" in the ID, the ID doesn't end with "plugin", and the name contains neither "Obsidian" nor "Plugin".

Note: the GitHub repository was renamed from `Obsidian-Kindle-Bridge` to `kindle-bridge` for consistency with the plugin's `id`/`name`, ahead of the initial public submission. That rename is a manual GitHub action performed outside of this codebase pass — after it's done, update your local clone's remote (see "Recommended Git Remote Update" in the final report).

## Prerequisites before submitting

- [ ] A GitHub account (already have — repository exists under `x5gtrn`).
- [ ] An Obsidian account, used to sign in at [community.obsidian.md](https://community.obsidian.md).
- [ ] `README.md` in the repository root describing the plugin's purpose and usage (done).
- [ ] `LICENSE` in the repository root (done — MIT).
- [ ] `manifest.json` in the repository root, accurate and committed to the default branch (verify the HEAD of `main` has the `1.0.2` version before submitting/updating, since the directory processes `manifest.json` at HEAD, not at the tagged release).

## Step 1: Publish to GitHub

Already done — this repository is hosted at `https://github.com/x5gtrn/kindle-bridge`.

## Step 2: Create a release

1. Confirm `manifest.json`'s `version` is `1.0.2` (Semantic Versioning, format `x.y.z`) — done.
2. Create a Git tag matching the version **exactly, with no `v` prefix**: `1.0.2`. Pushing this tag triggers `.github/workflows/release.yml`, which builds and creates a **draft** GitHub Release with `main.js` and `manifest.json` attached (no `styles.css` — this plugin doesn't ship one).
3. Review the draft release, add release notes (see [`CHANGELOG.md`](../CHANGELOG.md) `[1.0.2]`), and select **Publish release**.

`1.0.0` and `1.0.1` were already tagged and pushed to `origin` (see `git tag -l`). This section now describes the *next* release, `1.0.2` — a patch release addressing the community scorecard warnings documented in `CHANGELOG.md`.

Obsidian downloads `main.js`, `manifest.json`, and `styles.css` (if present) from the GitHub Release whose tag matches the `version` in `manifest.json` — the committed `manifest.json` in the repo is only used to determine the *latest available version*, not to serve the actual files.

## Step 3: Submit to the Community directory

1. Go to [community.obsidian.md](https://community.obsidian.md) and sign in with an Obsidian account.
2. Connect the GitHub account that owns this repository (grants read-only access to verify repository ownership).
3. Under **Plugins**, either claim this repository if it appears under **Available to claim**, or select **New plugin** and fill in:
   - **GitHub repository URL**: `https://github.com/x5gtrn/kindle-bridge`
   - **Owner**: yourself (or an organization, if applicable).
4. Review and agree to the [Developer policies](https://docs.obsidian.md/Developer+policies), confirm ongoing support commitment, and select **Submit**.

The directory reads `manifest.json` from the HEAD of the default branch (`main`) to validate the submission — make sure `main` has the `1.0.2` manifest committed before this step.

## Step 4: Address automated review feedback

After submitting, an automated review checks the manifest and repository. Any errors are shown in the directory; the plugin isn't installable from within Obsidian until they're resolved. To fix an issue, update the repository and publish a new GitHub release with an incremented version — you don't need to resubmit the form.

## `community-plugins.json` — for reference only

Obsidian's systems add this entry on your behalf when you submit through the web form above; you do not create or edit this file directly. Current schema (confirmed from the live file in `obsidianmd/obsidian-releases`):

```json
{
  "id": "kindle-bridge",
  "name": "Kindle Bridge",
  "author": "Daisuke Masuda",
  "description": "Sync Kindle highlights and notes from Amazon into per-book Markdown notes in your vault.",
  "repo": "x5gtrn/kindle-bridge"
}
```

This is shown here purely so the entry can be sanity-checked once it appears — do not fork `obsidian-releases` and open a PR to add this manually; that is not the current submission process.

## Disclosures required by the Developer policies

The [Developer policies](https://docs.obsidian.md/Developer+policies) require certain things to be "clearly indicated in your README" if applicable. Checked against this plugin:

| Disclosure | Applies? | Where documented |
|---|---|---|
| Payment required for full access | No | — |
| Account required for full access | Yes — an Amazon account | [README.md § Requirements](../README.md#requirements) |
| Network use | Yes — Amazon only | [README.md § Privacy](../README.md#privacy), [PRIVACY.md](../PRIVACY.md) |
| Accessing files outside the vault | Yes — the plugin's own browser-profile directory under the plugin's data folder inside `.obsidian/`, not outside the vault, and no other external file access | [README.md § Data Storage](../README.md#data-storage) |
| Static ads in the plugin's own UI | No | — |
| Server-side telemetry | No | [PRIVACY.md](../PRIVACY.md) |
| Closed-source code | No — MIT, fully open | [LICENSE](../LICENSE) |

Also required: not allowed to obfuscate code, insert ads, include client-side telemetry, or self-update. This plugin does none of these — confirmed during the security audit (see the final report's "Security Audit" section).

## Reviewer self-audit notes

This project runs the official [`eslint-plugin-obsidianmd`](https://github.com/obsidianmd/eslint-plugin) (the same rule set Obsidian's own review tooling uses) as part of `npm run lint`, wired into `eslint.config.mjs`. As of this writing, `npm run lint` passes with 0 errors and 1 accepted, documented warning — no unaddressed errors.

The following trade-offs were identified during this project's own pre-submission review and are worth having an answer ready for if a reviewer asks:

- **Node.js/Electron API usage** (`child_process.spawn`, browser profile directory) is scoped to launching and talking to an external Chromium-based browser for Amazon authentication — not used for vault file I/O, which goes exclusively through the Vault/FileManager APIs. `isDesktopOnly: true` is set accordingly. Production code does not import Node's `fs` module.
- **The scorecard's "Shell Execution" warning is expected and permanent** (see issue #9). Driving a real browser over CDP requires `child_process`, so the scanner flags it exactly as it flags Obsidian Git for running `git`. The full surface — one file, `spawn` plus `execFileSync`, a browser executable and `readlink`/`ps`/`rm` with fixed arguments, no shell, no interpolated user input — is documented in [SECURITY.md § Process execution surface](../SECURITY.md#process-execution-surface) and enforced by `src/amazon/cdp/processExecutionSurface.spec.ts`, so a reviewer can check the claim mechanically. The `readlink`/`ps`/`rm` calls exist because the previous review round asked for the Node `fs` import to go; they only touch the plugin's own browser-profile directory, and only to recover from a stale Chrome lock.
- **"Malware scan not available" is not specific to this plugin** (issue #9): the same disclosure appears on every plugin sampled from the directory, including Dataview, Templater and Obsidian Git, and no developer-side opt-in is documented anywhere. Nothing to act on.
- **Default (non-debug) log level is `info`, not error-only.** The Plugin guidelines suggest the console should show errors only by default. This plugin's `info`-level default is a deliberate choice to keep sync progress visible without enabling debug logging, and never logs credentials or full annotation text at any level (see [SECURITY.md](../SECURITY.md)). Console output is routed through `console.debug`/`console.warn`/`console.error` only (never `console.log`), per `obsidianmd/rule-custom-message`'s `no-console` configuration. This is a soft guideline, not a hard submission requirement, but is worth a one-line explanation if raised in review.
- **`joinVaultPath()`** (`src/utils/vaultPath.ts`) is a small, hand-rolled path-joining helper used instead of Obsidian's `normalizePath()`, specifically so the Markdown-generation code stays unit-testable outside a running Obsidian instance (`normalizePath` is a runtime-only export of the `obsidian` package, unavailable under Vitest). Inputs are the plugin's own settings values, not arbitrary external input.
- **`KindleBridgePlugin.pluginSettings`** is deliberately *not* named `settings`, even though that's the conventional name in most plugin examples. As of Obsidian 1.13.0, the base `Plugin` class itself declares an optional `settings?: unknown` field (part of the newer declarative-settings framework). Naming this plugin's own field `settings` would make `eslint-plugin-obsidianmd`'s `no-unsupported-api` rule (correctly) flag every access as requiring 1.13.0, even though the actual runtime behavior has no such dependency — it's a same-name collision at the type level, not a real compatibility issue. Renaming to `pluginSettings` avoids the collision entirely, with zero effect on stored data (the field name is never persisted; `loadData()`/`saveData()` serialize the settings object's own contents, not the class field name).
- **One `obsidianmd/no-tfile-tfolder-cast` warning remains**, in `src/markdown/BookNoteRepository.spec.ts`'s in-memory `FakeVault` test double (`{ path } as TFile`). The `obsidian` npm package is types-only (no runtime `TFile` class to construct or `instanceof`-check against — confirmed via `node_modules/obsidian/package.json`'s empty `"main"`), and this specific rule cannot be locally disabled (`eslint-comments/no-restricted-disable` blocks it). Left as an accepted warning rather than restructuring the test harness to depend on a real Obsidian runtime.
- **`getSettingDefinitions()` is implemented alongside `display()`.** Obsidian 1.13+ uses the declarative definitions (so settings appear in in-app settings search); older versions keep rendering through `display()`. `minAppVersion` stays `1.4.4`. Control values are read/written via `getControlValue`/`setControlValue` against `pluginSettings`, not `Plugin.settings`, to avoid the 1.13.0 type-level name collision described above.

## Announcing (after acceptance)

- [Share & showcase](https://forum.obsidian.md/c/share-showcase/9) on the Obsidian forums.
- `#updates` channel on the [Obsidian Discord](https://discord.gg/veuWUTm) (requires the `developer` role).
