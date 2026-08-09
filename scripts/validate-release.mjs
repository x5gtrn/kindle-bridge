#!/usr/bin/env node
// Sanity-checks this repository's release artifacts before a GitHub
// Release is published. Run after `npm run build`. Exits non-zero on
// any failure so it can be used as a CI gate.

import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const failures = [];
const warnings = [];

function fail(message) {
  failures.push(message);
}

function warn(message) {
  warnings.push(message);
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

// --- manifest.json ---
const manifestPath = join(root, "manifest.json");
if (!existsSync(manifestPath)) {
  fail("manifest.json is missing from the repository root.");
} else {
  const manifest = readJson(manifestPath);

  for (const field of [
    "id",
    "name",
    "version",
    "minAppVersion",
    "description",
    "author",
    "isDesktopOnly",
  ]) {
    if (manifest[field] === undefined || manifest[field] === "") {
      fail(`manifest.json is missing a value for required field "${field}".`);
    }
  }

  if (manifest.id && /obsidian/i.test(manifest.id)) {
    fail(`manifest.json "id" must not contain "obsidian" (found: "${manifest.id}").`);
  }
  if (manifest.id && /plugin$/i.test(manifest.id)) {
    fail(`manifest.json "id" must not end with "plugin" (found: "${manifest.id}").`);
  }
  if (manifest.id && !/^[a-z0-9-]+$/.test(manifest.id)) {
    fail(`manifest.json "id" must contain only lowercase letters, numbers, and hyphens (found: "${manifest.id}").`);
  }
  if (manifest.name && /obsidian/i.test(manifest.name)) {
    fail(`manifest.json "name" must not contain "Obsidian" (found: "${manifest.name}").`);
  }
  if (manifest.name && /plugin/i.test(manifest.name)) {
    fail(`manifest.json "name" must not contain "Plugin" (found: "${manifest.name}").`);
  }
  if (manifest.version && !/^\d+\.\d+\.\d+$/.test(manifest.version)) {
    fail(`manifest.json "version" must be in the form x.y.z (found: "${manifest.version}").`);
  }
  if (manifest.description && manifest.description.length > 250) {
    fail(`manifest.json "description" exceeds 250 characters (${manifest.description.length}).`);
  }
  if (manifest.description && !manifest.description.trim().endsWith(".")) {
    fail(`manifest.json "description" must end with a period.`);
  }
  if (manifest.description && /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(manifest.description)) {
    fail(`manifest.json "description" must not contain emoji.`);
  }

  // --- package.json / package-lock.json version alignment ---
  const packagePath = join(root, "package.json");
  if (existsSync(packagePath)) {
    const pkg = readJson(packagePath);
    if (pkg.version !== manifest.version) {
      fail(
        `package.json version ("${pkg.version}") does not match manifest.json version ("${manifest.version}").`,
      );
    }
  } else {
    fail("package.json is missing from the repository root.");
  }

  const lockPath = join(root, "package-lock.json");
  if (existsSync(lockPath)) {
    const lock = readJson(lockPath);
    const lockVersion = lock.packages?.[""]?.version ?? lock.version;
    if (lockVersion !== manifest.version) {
      fail(
        `package-lock.json version ("${lockVersion}") does not match manifest.json version ("${manifest.version}").`,
      );
    }
  } else {
    warn("package-lock.json is missing from the repository root.");
  }

  // --- versions.json ---
  // Per Obsidian's versions.json spec, an entry is only required when
  // minAppVersion changes between releases - not for every version. So
  // a missing entry for the current version is valid (and common for a
  // patch release), not a failure. Only an existing-but-mismatched
  // entry is an actual problem.
  const versionsPath = join(root, "versions.json");
  if (!existsSync(versionsPath)) {
    fail("versions.json is missing from the repository root.");
  } else {
    const versions = readJson(versionsPath);
    if (versions[manifest.version] === undefined) {
      warn(
        `versions.json has no entry for the current version "${manifest.version}" - fine if minAppVersion hasn't changed since the last version that does have one.`,
      );
    } else if (versions[manifest.version] !== manifest.minAppVersion) {
      fail(
        `versions.json["${manifest.version}"] ("${versions[manifest.version]}") does not match manifest.json minAppVersion ("${manifest.minAppVersion}").`,
      );
    }
  }

  // --- main.js build artifact ---
  const mainPath = join(root, "main.js");
  if (!existsSync(mainPath)) {
    fail("main.js is missing. Run `npm run build` first.");
  } else {
    const stat = statSync(mainPath);
    if (stat.size === 0) {
      fail("main.js exists but is empty.");
    }
    const contents = readFileSync(mainPath, "utf8");
    if (contents.includes("sourceMappingURL")) {
      fail("main.js contains a source map reference; production builds must not.");
    }
    // Coarse absolute-path leak check (dev-machine paths, not just "/Users/").
    if (/\/(Users|home)\/[^/"'\s]+\//.test(contents)) {
      fail("main.js appears to contain a developer-machine absolute file path.");
    }
    // Very coarse secret-shaped literal check. Intentionally conservative
    // (false positives are fine here; this is a last-line sanity net, not
    // a substitute for the manual security audit).
    const secretPatterns = [
      /-----BEGIN (RSA |OPENSSH |EC )?PRIVATE KEY-----/,
      /AKIA[0-9A-Z]{16}/, // AWS access key id shape
      /sk-[A-Za-z0-9]{20,}/, // common "sk-..." API key shape
    ];
    for (const pattern of secretPatterns) {
      if (pattern.test(contents)) {
        fail(`main.js appears to contain a secret matching ${pattern}.`);
      }
    }
  }

  // styles.css is optional; only sanity-check it if present.
  const stylesPath = join(root, "styles.css");
  if (existsSync(stylesPath)) {
    const size = statSync(stylesPath).size;
    if (size === 0) {
      warn("styles.css exists but is empty; consider removing it from the release assets.");
    }
  }
}

// --- forbidden legacy identifiers ---
const forbiddenStrings = ["obsidian-kindle-bridge", "ObsidianKindleBridge"];
for (const file of ["manifest.json", "package.json", "main.js"]) {
  const path = join(root, file);
  if (!existsSync(path)) continue;
  const contents = readFileSync(path, "utf8");
  for (const needle of forbiddenStrings) {
    if (contents.includes(needle)) {
      fail(`${file} still contains the legacy identifier "${needle}".`);
    }
  }
}

// --- report ---
for (const message of warnings) {
  console.warn(`WARN  ${message}`);
}
for (const message of failures) {
  console.error(`FAIL  ${message}`);
}

if (failures.length > 0) {
  console.error(`\nvalidate-release: ${failures.length} failure(s).`);
  process.exit(1);
}

console.log(`validate-release: OK (${warnings.length} warning(s)).`);
