# Kindle Bridge 1.0.1

Patch release. No user-facing feature changes — this fixes issues found by Obsidian's own plugin review tooling ahead of Community Plugin submission.

## Fixed

- Removed a false minimum-version dependency: the plugin's own `settings` field was renamed internally to `pluginSettings`. Obsidian 1.13.0 added an official, identically-named `Plugin.settings` field, and the name collision made automated review tooling report this plugin as requiring Obsidian 1.13.0+ — it does not. `minAppVersion` remains `1.4.4`. This has no effect on your existing settings; the field name is never persisted to `data.json`.
- Removed the redundant "kindle-bridge-" prefix from internal command IDs. Obsidian already namespaces commands by plugin ID, so this had no visible effect, but is now consistent with the guideline.
- Removed a call to `setDynamicTooltip()`, deprecated by Obsidian (the slider tooltip is now always shown inline regardless).

## Changed

- Replaced the `builtin-modules` dependency with Node's built-in equivalent, removing one dependency.
- Default console logging now uses `console.debug` instead of `console.log`, matching Obsidian's console-logging guideline.
- Adopted the official `eslint-plugin-obsidianmd` rule set in this project's lint configuration and CI, so this class of issue is caught automatically in the future.

## Upgrading

No action needed. If you're building from source, `npm ci && npm run build` as usual.

## Installation

Same as 1.0.0 — see [README.md § Installation](../README.md#installation).

## Disclaimer

Kindle Bridge is an independent community plugin and is not affiliated with, endorsed by, or sponsored by Amazon or Obsidian.
