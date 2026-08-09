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
- Dependency vulnerabilities in `cheerio` (the plugin's only runtime dependency) that are actually reachable through Kindle Bridge's usage of it.

Please still report other bugs (crashes, incorrect parsing, etc.) as regular public issues — this policy is specifically for vulnerabilities with security or privacy impact.

## Authentication and session vulnerabilities

Because Kindle Bridge never itself handles your Amazon password, one-time code, or cookies (they stay entirely within the separate browser process it launches — see [README.md § Authentication](README.md#authentication)), most classic credential-handling vulnerabilities don't apply to the plugin's own code. If you find a way for the plugin to obtain, log, or leak any of that data, please treat it as a high-severity report and use private reporting if available.

## Scope

This policy covers the Kindle Bridge plugin source code in this repository. It does not cover:

- Amazon's own website, sign-in flow, or infrastructure.
- The Obsidian application itself.
- The Chrome/Edge/Chromium/Brave browser you have installed.

Please report issues in those systems to their respective maintainers.
