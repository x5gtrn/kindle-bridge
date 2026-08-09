import type { TFile, Vault } from "obsidian";
import { beforeEach, describe, expect, it } from "vitest";
import type { SyncResult } from "../sync/SyncProgress";
import { DailyNoteAppender } from "./DailyNoteAppender";

interface FakeNode {
  path: string;
  content: string;
}

class FakeVault {
  files = new Map<string, FakeNode>();

  getAbstractFileByPath(path: string) {
    const file = this.files.get(path);
    return file ? { path: file.path, children: undefined } : null;
  }

  process(file: TFile, fn: (data: string) => string): Promise<string> {
    const existing = this.files.get(file.path);
    if (!existing) {
      return Promise.reject(new Error(`not found: ${file.path}`));
    }
    existing.content = fn(existing.content);
    return Promise.resolve(existing.content);
  }
}

function emptyResult(): SyncResult {
  return {
    booksFound: 0,
    notesCreated: 0,
    notesUpdated: 0,
    highlightsFetched: 0,
    highlightNotesFetched: 0,
    skipped: 0,
    notesFlaggedRemoved: 0,
    errors: 0,
  };
}

const options = { folder: "Daily Notes", dateFormat: "YYYY-MM-DD" };
const formatDate = () => "2026-08-07";

function buildAppender(vault: FakeVault): DailyNoteAppender {
  return new DailyNoteAppender(vault as unknown as Vault, formatDate);
}

describe("DailyNoteAppender", () => {
  let vault: FakeVault;

  beforeEach(() => {
    vault = new FakeVault();
  });

  it("does nothing when the sync result has zero meaningful activity", async () => {
    const path = "Daily Notes/2026-08-07.md";
    vault.files.set(path, { path, content: "# 2026-08-07\n" });

    await buildAppender(vault).appendSyncSummary(emptyResult(), options);

    expect(vault.files.get(path)?.content).toBe("# 2026-08-07\n");
  });

  it("does nothing (and never creates the file) when today's Daily Note doesn't exist", async () => {
    const result: SyncResult = { ...emptyResult(), notesCreated: 1 };

    await buildAppender(vault).appendSyncSummary(result, options);

    expect(vault.files.size).toBe(0);
  });

  it("appends a summary line to an existing Daily Note", async () => {
    const path = "Daily Notes/2026-08-07.md";
    vault.files.set(path, { path, content: "# 2026-08-07\n\nSome journal entry." });
    const result: SyncResult = {
      ...emptyResult(),
      notesCreated: 2,
      notesUpdated: 1,
      notesFlaggedRemoved: 1,
      highlightsFetched: 12,
      highlightNotesFetched: 3,
    };

    await buildAppender(vault).appendSyncSummary(result, options);

    const content = vault.files.get(path)?.content ?? "";
    expect(content).toContain("Some journal entry.");
    expect(content).toContain("Kindle Bridge");
    expect(content).toContain("2 created");
    expect(content).toContain("1 updated");
    expect(content).toContain("1 flagged as removed");
    expect(content).toContain("12 highlights");
    expect(content).toContain("3 notes");
  });

  it("resolves the path from the folder and injected date formatter", async () => {
    const path = "Daily Notes/2026-08-07.md";
    vault.files.set(path, { path, content: "" });
    const result: SyncResult = { ...emptyResult(), notesCreated: 1 };

    await buildAppender(vault).appendSyncSummary(result, options);

    expect(vault.files.get(path)?.content).toContain("Kindle Bridge");
  });

  it("treats an empty folder setting as the vault root", async () => {
    const path = "2026-08-07.md";
    vault.files.set(path, { path, content: "" });
    const result: SyncResult = { ...emptyResult(), notesCreated: 1 };

    await buildAppender(vault).appendSyncSummary(result, { ...options, folder: "" });

    expect(vault.files.get(path)?.content).toContain("Kindle Bridge");
  });

  it("appends a new line on each call rather than replacing the previous one", async () => {
    const path = "Daily Notes/2026-08-07.md";
    vault.files.set(path, { path, content: "# 2026-08-07\n" });
    const result: SyncResult = { ...emptyResult(), notesCreated: 1 };
    const appender = buildAppender(vault);

    await appender.appendSyncSummary(result, options);
    await appender.appendSyncSummary(result, options);

    const content = vault.files.get(path)?.content ?? "";
    expect(content.split("Kindle Bridge")).toHaveLength(3);
  });
});
