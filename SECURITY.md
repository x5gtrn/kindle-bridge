# Security Policy

## Supported versions

Kindle Bridge follows [Semantic Versioning](https://semver.org/). Only the latest published release is actively supported with security fixes. Please update to the latest version before reporting an issue.

| Version | Supported |
|---|---|
| 1.x (latest) | Yes |
| < 1.0 (pre-release) | No |

## Reporting a vulnerability

**Please do not open a public GitHub issue for a security vulnerability.**

If this repository has [GitHub private vulnerability reporting](https://docs.github.com/en/code-security/security-advisories/guidance-on-reporting-and-writing/privately-reporting-a-security-vulnerability) enabled (check the repository's **Security** tab → **Advisories** → **Report a vulnerability**), please use that. It creates a private discussion visible only to you and the maintainer until a fix is ready.

If private reporting is not available, open a regular GitHub issue containing **only**:

- A short description of the vulnerability class (e.g. "possible credential exposure in X").
- Which version is affected.
- A request to be contacted privately for details.

Do not include exploit details, credentials, tokens, cookies, or personal data in a public issue. A maintainer will follow up to arrange a private channel for the full report.

## What counts as a security issue here

Given how Kindle Bridge works (see [README.md § Authentication](README.md#authentication) and [PRIVACY.md](PRIVACY.md)), the most relevant categories are:

- Any code path that would cause Kindle Bridge to read, store, log, or transmit an Amazon password, one-time code, or cookie value.
- Any code path that could leak the contents of the plugin's browser profile directory (see [PRIVACY.md § Local storage](PRIVACY.md#local-storage)) to a third party.
- Injection vulnerabilities (e.g. command injection in the browser-launch path, unsafe HTML/DOM construction in the settings UI or modals).
- Any network destination other than Amazon's own domains and the plugin's local Chrome DevTools Protocol connection.
- Path traversal or unsafe file overwrite in note generation.
- Dependency vulnerabilities in bundled runtime code that are actually reachable through Kindle Bridge's usage of it. Kindle Bridge has no npm production dependencies; Amazon HTML is parsed with the runtime `DOMParser`.

Please still report other bugs (crashes, incorrect parsing, etc.) as regular public issues — this policy is specifically for vulnerabilities with security or privacy impact.

## Authentication and session vulnerabilities

Because Kindle Bridge never itself handles your Amazon password, one-time code, or cookies (they stay entirely within the separate browser process it launches — see [README.md § Authentication](README.md#authentication)), most classic credential-handling vulnerabilities don't apply to the plugin's own code. If you find a way for the plugin to obtain, log, or leak any of that data, please treat it as a high-severity report and use private reporting if available.

## Process execution surface

Kindle Bridge starts external processes. This is what the community directory scorecard's **Shell Execution** warning refers to, and this section documents the whole of it. Every call lives in `src/amazon/cdp/CdpBrowser.ts`; `src/amazon/cdp/processExecutionSurface.spec.ts` fails the build if any of the invariants below stop holding.

| What is executed | Arguments | Why |
|---|---|---|
| A Chrome/Edge/Chromium/Brave executable | `--user-data-dir=<plugin's own profile dir>`, `--remote-debugging-port=0`, `--no-first-run`, `--no-default-browser-check`, optionally `--headless=new`, `about:blank` | Amazon sign-in and page fetches run in a real browser process, driven over the Chrome DevTools Protocol. The executable is picked from a hard-coded list of standard install paths per OS (`src/amazon/cdp/browserExecutable.ts`); a browser is never downloaded, installed, or updated by this plugin. |
| `readlink` | The path of `SingletonLock` inside the plugin's own browser profile directory | Chrome refuses to start against a profile whose `SingletonLock` symlink is still present. Reading it yields the pid that owns the lock. |
| `ps` | `-p <pid> -o comm=` | Before deciding a lock is stale, confirm the pid it names isn't a live browser (pids get reused). If it can't be ruled out as a browser, the lock is left alone and Chrome's own error is allowed to surface. |
| `rm` | `-f -- <path>`, for the three `Singleton*` files inside the plugin's own browser profile directory | Clear a confirmed-stale lock so sign-in can proceed. Without this, one crashed browser process makes every later sign-in fail until the user deletes the files by hand. |

The invariants:

- `child_process` is imported in exactly one file, and only `spawn` and `execFileSync` are used. `exec`, `execSync`, `spawnSync`, `execFile` and `fork` are not used anywhere.
- `shell: true` is never passed, so no argument is ever interpreted by a shell.
- Every argument is either a compile-time constant, a path derived from the plugin's own profile directory, or a pid this plugin read from its own lock file. Nothing you type — settings, folder names, note contents, book titles — reaches an argument list.
- The three utility commands are POSIX-only recovery paths guarded by an early `process.platform === "win32"` return, and they only ever touch files inside `<vault>/.obsidian/plugins/kindle-bridge/browser-profile/`.

`readlink`/`ps`/`rm` are used in place of Node's `fs` module deliberately: Obsidian's review flags a production `fs` import as filesystem access outside the Vault API, and `child_process` is already required for the browser launch. All vault file I/O goes through Obsidian's Vault/FileManager APIs, never through either of these.

## Scope

This policy covers the Kindle Bridge plugin source code in this repository. It does not cover:

- Amazon's own website, sign-in flow, or infrastructure.
- The Obsidian application itself.
- The Chrome/Edge/Chromium/Brave browser you have installed.

Please report issues in those systems to their respective maintainers.
