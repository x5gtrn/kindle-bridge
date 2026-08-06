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

    it("parses a highlight with no memo/location/page/date (ann-1)", () => {
      const ann = annotations[0];
      expect(ann).toBeDefined();
      expect(ann?.type).toBe("highlight");
      expect(ann?.text).toContain("Programs must be written");
      expect(ann?.memo).toBeUndefined();
      expect(ann?.location).toBeUndefined();
      expect(ann?.page).toBeUndefined();
      expect(ann?.createdAt).toBeUndefined();
    });

    it("associates a highlight with its memo, location, page, and created date (ann-2)", () => {
      const ann = annotations[1];
      expect(ann).toBeDefined();
      expect(ann?.type).toBe("highlight");
      expect(ann?.text).toContain("The best design is the simplest");
      expect(ann?.memo).toBe("Re-read this before the next design review.");
      expect(ann?.location).toBe("1240");
      expect(ann?.page).toBe("42");
      expect(ann?.createdAt).toBe("2026-08-01");
    });

    it("parses a memo with no underlying highlight text as type memo (ann-3)", () => {
      const ann = annotations[2];
      expect(ann).toBeDefined();
      expect(ann?.type).toBe("memo");
      expect(ann?.text).toBe("A note without a highlighted passage.");
      expect(ann?.memo).toBeUndefined();
    });

    it("parses location without page/date (ann-4)", () => {
      const ann = annotations[3];
      expect(ann?.location).toBe("5001");
      expect(ann?.page).toBeUndefined();
      expect(ann?.createdAt).toBeUndefined();
    });

    it("parses page without location/date (ann-5)", () => {
      const ann = annotations[4];
      expect(ann?.page).toBe("88");
      expect(ann?.location).toBeUndefined();
      expect(ann?.createdAt).toBeUndefined();
    });

    it("parses created date without location/page (ann-6)", () => {
      const ann = annotations[5];
      expect(ann?.createdAt).toBe("2026-08-02");
      expect(ann?.location).toBeUndefined();
      expect(ann?.page).toBeUndefined();
    });

    it("parses location and page together without a date (ann-7)", () => {
      const ann = annotations[6];
      expect(ann?.location).toBe("6100");
      expect(ann?.page).toBe("120");
      expect(ann?.createdAt).toBeUndefined();
    });

    it("filters out a block with a whitespace-only highlight and no memo (ann-8)", () => {
      expect(annotations).toHaveLength(7);
      const texts = annotations.map((a) => a.text);
      expect(texts.every((t) => t.trim().length > 0)).toBe(true);
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

  describe("Japan region date parsing", () => {
    it("parses the YYYY年M月D日 created date format", () => {
      const html = loadFixture("annotations-jp.html");
      const annotations = parseAnnotations(html, "book-jp-1", getAmazonRegion("jp"));
      expect(annotations).toHaveLength(1);
      expect(annotations[0]?.createdAt).toBe("2026-07-20");
      expect(annotations[0]?.text).toBe("人は見た目が9割。");
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

    it("changes the content hash when the highlighted text changes, independent of location/page/date", () => {
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
          <div class="a-row a-spacing-base kp-notebook-annotation">
            <div class="kp-notebook-highlight-text">A highlight with an empty note element.</div>
            <div class="kp-notebook-note-text">   </div>
          </div>
        </div>
      `;
      const [annotation] = parseAnnotations(html, "book-1", getAmazonRegion("global"));
      expect(annotation).toBeDefined();
      expect(annotation?.type).toBe("highlight");
      expect(annotation?.memo).toBeUndefined();
    });

    it("treats a present-but-empty location/page/created value the same as an absent attribute", () => {
      const html = `
        <div id="kp-notebook-annotations">
          <div class="a-row a-spacing-base kp-notebook-annotation">
            <div class="kp-notebook-highlight-text">A highlight with blank metadata attributes.</div>
            <input type="hidden" class="kp-annotation-location" value="" />
            <input type="hidden" class="kp-annotation-page" value="   " />
            <input type="hidden" class="kp-annotation-created" value="" />
          </div>
        </div>
      `;
      const [annotation] = parseAnnotations(html, "book-1", getAmazonRegion("global"));
      expect(annotation?.location).toBeUndefined();
      expect(annotation?.page).toBeUndefined();
      expect(annotation?.createdAt).toBeUndefined();
    });
  });
});
