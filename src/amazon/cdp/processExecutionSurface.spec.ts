import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Guards the plugin's whole external-process surface, which is what the
 * community directory scorecard's "Shell Execution" warning refers to
 * (see SECURITY.md § Process execution surface, and issue #9).
 *
 * The warning itself is permanent and correct - launching a browser to
 * sign in to Amazon requires `child_process` - so the point of these
 * tests is to keep the surface as small as it is documented to be: one
 * file, two APIs, four commands, no shell, no interpolated input. They
 * read the production sources as text rather than importing them,
 * because the invariants are about what the code is *allowed to
 * contain*, not about what any one function returns.
 */

const SRC_ROOT = join(import.meta.dirname, "..", "..");
const CHILD_PROCESS_FILE = "amazon/cdp/CdpBrowser.ts";
/** Commands executed by name (resolved through PATH), as opposed to the
 * browser executable, which is always an absolute path. */
const ALLOWED_COMMANDS = ["ps", "readlink", "rm"];
/** `child_process` APIs that take a command line rather than an argv
 * array, or that spawn a second Node runtime. */
const FORBIDDEN_APIS = ["exec", "execSync", "spawnSync", "fork"];

function productionSources(): { path: string; source: string }[] {
  const files: { path: string; source: string }[] = [];

  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== "tests") {
          walk(full);
        }
      } else if (entry.name.endsWith(".ts") && !entry.name.endsWith(".spec.ts")) {
        files.push({
          path: relative(SRC_ROOT, full).split("\\").join("/"),
          source: readFileSync(full, "utf8"),
        });
      }
    }
  };

  walk(SRC_ROOT);
  return files;
}

describe("process execution surface", () => {
  const sources = productionSources();

  it("finds the production sources it is supposed to be checking", () => {
    expect(sources.length).toBeGreaterThan(10);
    expect(sources.map((f) => f.path)).toContain(CHILD_PROCESS_FILE);
  });

  it("imports child_process in exactly one file", () => {
    const importers = sources
      .filter((f) => /from "(?:node:)?child_process"/.test(f.source))
      .map((f) => f.path);

    expect(importers).toEqual([CHILD_PROCESS_FILE]);
  });

  it("imports only spawn and execFileSync from child_process", () => {
    const file = sources.find((f) => f.path === CHILD_PROCESS_FILE);
    const importMatch = /import\s*\{([^}]*)\}\s*from\s*"(?:node:)?child_process"/.exec(
      file?.source ?? "",
    );
    const imported = (importMatch?.[1] ?? "")
      .split(",")
      .map((name) => name.replace(/^\s*type\s+/, "").trim())
      .filter(Boolean)
      .sort();

    expect(imported).toEqual(["ChildProcess", "execFileSync", "spawn"]);
  });

  it("never uses a child_process API that takes a command line or forks Node", () => {
    for (const { path, source } of sources) {
      for (const api of FORBIDDEN_APIS) {
        // The lookbehind keeps `SOME_PATTERN.exec(...)` (RegExp's own
        // method, used all over the parsing code) out of the match.
        expect(
          new RegExp(`(?<![.\\w$])${api}\\s*\\(`).test(source),
          `${path} must not call ${api}()`,
        ).toBe(false);
      }
    }
  });

  it("never asks for a shell", () => {
    for (const { path, source } of sources) {
      expect(/shell\s*:\s*true/.test(source), `${path} must not pass shell: true`).toBe(false);
    }
  });

  it("executes only the documented commands, each with a literal name", () => {
    const file = sources.find((f) => f.path === CHILD_PROCESS_FILE);
    const executed = [...(file?.source ?? "").matchAll(/execFileSync\(\s*(.+?)\s*,/g)].map(
      (match) => match[1] ?? "",
    );

    // Every call names its command as a string literal - never a
    // variable, template literal or concatenation, so the set below is
    // the complete list of what can run.
    expect(executed.every((argument) => /^"[a-z]+"$/.test(argument))).toBe(true);
    expect([...new Set(executed.map((argument) => argument.slice(1, -1)))].sort()).toEqual(
      ALLOWED_COMMANDS,
    );
  });

  it("spawns only a browser found at an absolute path", () => {
    const file = sources.find((f) => f.path === CHILD_PROCESS_FILE);
    const spawned = [...(file?.source ?? "").matchAll(/[^.\w]spawn\(\s*(.+?)\s*,/g)].map(
      (match) => match[1] ?? "",
    );

    expect(spawned).toEqual(["executablePath"]);
  });
});
