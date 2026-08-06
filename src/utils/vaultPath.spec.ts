import { describe, expect, it } from "vitest";
import { joinVaultPath } from "./vaultPath";

describe("joinVaultPath", () => {
  it("joins simple segments with a single slash", () => {
    expect(joinVaultPath("Books", "Title.md")).toBe("Books/Title.md");
  });

  it("collapses duplicate slashes from segments that already contain slashes", () => {
    expect(joinVaultPath("Highlight and Memo/Books/", "/Title.md")).toBe(
      "Highlight and Memo/Books/Title.md",
    );
  });

  it("strips blank segments", () => {
    expect(joinVaultPath("Books", "", "Title.md")).toBe("Books/Title.md");
  });

  it("returns an empty string for no meaningful input", () => {
    expect(joinVaultPath("", "  ", "/")).toBe("");
  });
});
