import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { getAmazonRegion } from "./AmazonRegion";
import { parseAnnotations } from "./KindleAnnotationParser";
import { KindleParseError } from "./KindleParseError";

const FIXTURES_DIR = join(dirname(fileURLToPath(import.meta.url)), "../tests/fixtures");

function loadFixture(name: string): string {
  return readFileSync(join(FIXTURES_DIR, name), "utf8");
}

function byAnnotationIndex(html: string, region = getAmazonRegion("global")) {
  return parseAnnotations(html, "book-1", region);
}

describe("parseAnnotations", () => {
  it("rejects empty HTML with a KindleParseError", () => {
    expect(() => parseAnnotations("", "book-1", getAmazonRegion("jp"))).toThrow(KindleParseError);
  });

  it("throws a KindleParseError (not a silent empty result) when the page structure is unrecognized", () => {
    const html = loadFixture("annotations-malformed.html");
    expect(() => byAnnotationIndex(html)).toThrow(/Amazon's page structure may have changed/);
  });

  describe("annotations-full.html (Global region)", () => {
    const html = loadFixture("annotations-full.html");
    const annotations = byAnnotationIndex(html);

    it("parses a highlight with no memo/location (ann-1)", () => {
      const ann = annotations[0];
      expect(ann).toBeDefined();
      expect(ann?.type).toBe("highlight");
      expect(ann?.text).toContain("Programs must be written");
      expect(ann?.memo).toBeUndefined();
      expect(ann?.location).toBeUndefined();
    });

    it("associates a highlight with its memo and location (ann-2)", () => {
      const ann = annotations[1];
      expect(ann).toBeDefined();
      expect(ann?.type).toBe("highlight");
      expect(ann?.text).toContain("The best design is the simplest");
      expect(ann?.memo).toBe("Re-read this before the next design review.");
      expect(ann?.location).toBe("1240");
    });

    it("parses a freestanding memo (no underlying highlight) as type memo (ann-3)", () => {
      const ann = annotations[2];
      expect(ann).toBeDefined();
      expect(ann?.type).toBe("memo");
      expect(ann?.text).toBe("A note without a highlighted passage.");
      expect(ann?.memo).toBeUndefined();
    });

    it("filters out a block with a whitespace-only highlight and no memo (ann-4)", () => {
      expect(annotations).toHaveLength(3);
      const texts = annotations.map((a) => a.text);
      expect(texts.every((t) => t.trim().length > 0)).toBe(true);
    });

    it("never populates page or createdAt - Amazon's current markup exposes neither", () => {
      for (const ann of annotations) {
        expect(ann.page).toBeUndefined();
        expect(ann.createdAt).toBeUndefined();
      }
    });

    it("builds a Kindle Reader source URL for every annotation", () => {
      for (const ann of annotations) {
        expect(ann.sourceUrl).toContain("read.amazon.com/notebook");
        expect(ann.sourceUrl).toContain("book-1");
      }
    });

    it("gives every annotation a bookId matching the requested book", () => {
      expect(annotations.every((a) => a.bookId === "book-1")).toBe(true);
    });
  });

  describe("Japan region", () => {
    it("parses Japanese highlight text and location", () => {
      const html = loadFixture("annotations-jp.html");
      const annotations = parseAnnotations(html, "book-jp-1", getAmazonRegion("jp"));
      expect(annotations).toHaveLength(1);
      expect(annotations[0]?.text).toBe("人は見た目が9割。");
      expect(annotations[0]?.location).toBe("300");
    });
  });

  describe("annotation id and content hash", () => {
    const html = loadFixture("annotations-full.html");

    it("is deterministic: re-parsing identical HTML yields identical ids and hashes", () => {
      const first = byAnnotationIndex(html);
      const second = byAnnotationIndex(html);
      expect(first.map((a) => a.id)).toEqual(second.map((a) => a.id));
      expect(first.map((a) => a.contentHash)).toEqual(second.map((a) => a.contentHash));
    });

    it("produces different ids for annotations with different content", () => {
      const annotations = byAnnotationIndex(html);
      const ids = annotations.map((a) => a.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it("changes the content hash when the highlighted text changes, independent of location", () => {
      const original = byAnnotationIndex(html)[0];
      const editedHtml = html.replace(
        "Programs must be written for people to read, and only incidentally for machines to execute.",
        "A different highlight entirely.",
      );
      const edited = byAnnotationIndex(editedHtml)[0];
      expect(original).toBeDefined();
      expect(edited).toBeDefined();
      expect(edited?.contentHash).not.toBe(original?.contentHash);
    });

    it("keeps the same id and content hash across parser runs for a book/region-scoped annotation", () => {
      const region = getAmazonRegion("jp");
      const jpHtml = loadFixture("annotations-jp.html");
      const first = parseAnnotations(jpHtml, "book-jp-1", region)[0];
      const second = parseAnnotations(jpHtml, "book-jp-1", region)[0];
      expect(first?.id).toBe(second?.id);
      expect(first?.contentHash).toBe(second?.contentHash);
    });
  });

  describe("present-but-empty vs. absent optional fields", () => {
    it("treats a present-but-whitespace-only memo element the same as no memo at all", () => {
      const html = `
        <div id="kp-notebook-annotations">
          <div id="ann-1" class="a-row a-spacing-base">
            <div id="highlight-ann-1" class="a-row kp-notebook-highlight">
              <span id="highlight">A highlight with an empty note element.</span>
            </div>
            <div id="note-ann-1" class="a-row kp-notebook-note aok-hidden">
              <span id="note">   </span>
            </div>
          </div>
        </div>
      `;
      const [annotation] = parseAnnotations(html, "book-1", getAmazonRegion("global"));
      expect(annotation).toBeDefined();
      expect(annotation?.type).toBe("highlight");
      expect(annotation?.memo).toBeUndefined();
    });

    it("treats a present-but-empty location value the same as an absent one", () => {
      const html = `
        <div id="kp-notebook-annotations">
          <div id="ann-1" class="a-row a-spacing-base">
            <input type="hidden" value="" id="kp-annotation-location" />
            <div id="highlight-ann-1" class="a-row kp-notebook-highlight">
              <span id="highlight">A highlight with a blank location attribute.</span>
            </div>
          </div>
        </div>
      `;
      const [annotation] = parseAnnotations(html, "book-1", getAmazonRegion("global"));
      expect(annotation?.location).toBeUndefined();
    });
  });
});
