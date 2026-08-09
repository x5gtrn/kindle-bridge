import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { getAmazonRegion } from "./AmazonRegion";
import { parseBookList } from "./KindleBookParser";
import { KindleParseError } from "./KindleParseError";

const FIXTURES_DIR = join(dirname(fileURLToPath(import.meta.url)), "../tests/fixtures");

function loadFixture(name: string): string {
  return readFileSync(join(FIXTURES_DIR, name), "utf8");
}

describe("parseBookList", () => {
  it("rejects empty HTML with a KindleParseError", () => {
    expect(() => parseBookList("", getAmazonRegion("jp"))).toThrow(KindleParseError);
  });

  it("throws a KindleParseError (not a silent empty result) when the page structure is unrecognized", () => {
    const html = loadFixture("books-malformed.html");
    expect(() => parseBookList(html, getAmazonRegion("global"))).toThrow(
      /Amazon's page structure may have changed/,
    );
  });

  describe("Japan region", () => {
    const region = getAmazonRegion("jp");
    const books = parseBookList(loadFixture("books-jp.html"), region);

    it("parses every book in the library", () => {
      expect(books).toHaveLength(2);
    });

    it("parses title, ASIN, author, cover image, and last-annotated date", () => {
      const book = books[0];
      expect(book).toBeDefined();
      expect(book?.id).toBe("B0JPBOOK0001");
      expect(book?.asin).toBe("B0JPBOOK0001");
      expect(book?.title).toBe("The Road to Being a Pragmatic Programmer");
      expect(book?.authors).toEqual(["Sample Taro"]);
      expect(book?.coverImageUrl).toBe("https://m.media-amazon.com/images/I/jp-sample-cover-1.jpg");
      expect(book?.lastAnnotatedAt).toBe("2026-07-15");
      expect(book?.amazonUrl).toBe("https://www.amazon.co.jp/dp/B0JPBOOK0001");
      expect(book?.region).toBe("jp");
    });

    it("strips the Japanese author-name prefix", () => {
      expect(books[0]?.authors).not.toContain("著者： Sample Taro");
    });

    it("handles a book missing author, cover image, and last-annotated date", () => {
      const book = books[1];
      expect(book).toBeDefined();
      expect(book?.title).toBe("Title-Only Sample Book (JP)");
      expect(book?.authors).toEqual([]);
      expect(book?.coverImageUrl).toBeUndefined();
      expect(book?.lastAnnotatedAt).toBeUndefined();
    });

  });

  it("still parses the last-annotated date when a JP-region account rendered it in English (confirmed live, 2026-08-10)", () => {
    const html = `
      <div id="kp-notebook-library">
        <div id="B0JPBOOK0099" class="a-row kp-notebook-library-each-book">
          <span class="a-declarative" data-action="get-annotations-for-asin">
            <a class="a-link-normal a-text-normal" href="javascript:void(0);">
              <h2 class="a-size-base a-color-base a-text-center kp-notebook-searchable a-text-bold">Sample Book With an English-Rendered Date</h2>
              <p class="a-spacing-base a-spacing-top-mini a-text-center a-size-base a-color-secondary kp-notebook-searchable">著者： Hanako English</p>
            </a>
          </span>
          <input type="hidden" name="" value="Sunday, August 9, 2026" id="kp-notebook-annotated-date-B0JPBOOK0099" />
        </div>
      </div>
    `;
    const [book] = parseBookList(html, getAmazonRegion("jp"));
    expect(book).toBeDefined();
    expect(book?.authors).toEqual(["Hanako English"]);
    expect(book?.lastAnnotatedAt).toBe("2026-08-09");
  });

  describe("Global region", () => {
    const region = getAmazonRegion("global");
    const books = parseBookList(loadFixture("books-global.html"), region);

    it("parses every book in the library", () => {
      expect(books).toHaveLength(2);
    });

    it("parses title, ASIN, author, cover image, and last-annotated date", () => {
      const book = books[0];
      expect(book).toBeDefined();
      expect(book?.id).toBe("B0GLOBALBOOK01");
      expect(book?.title).toBe("Sample Book Title");
      expect(book?.authors).toEqual(["Jane Example"]);
      expect(book?.coverImageUrl).toBe(
        "https://m.media-amazon.com/images/I/global-sample-cover-1.jpg",
      );
      expect(book?.lastAnnotatedAt).toBe("2026-07-15");
      expect(book?.amazonUrl).toBe("https://www.amazon.com/dp/B0GLOBALBOOK01");
      expect(book?.region).toBe("global");
    });

    it("strips the 'By: ' author-name prefix", () => {
      expect(books[0]?.authors).not.toContain("By: Jane Example");
    });

    it("handles a book missing author, cover image, and last-annotated date", () => {
      const book = books[1];
      expect(book).toBeDefined();
      expect(book?.authors).toEqual([]);
      expect(book?.coverImageUrl).toBeUndefined();
      expect(book?.lastAnnotatedAt).toBeUndefined();
    });
  });

  it("parses Japan and Global date formats differently for the same raw library shape", () => {
    const jpBooks = parseBookList(loadFixture("books-jp.html"), getAmazonRegion("jp"));
    const globalBooks = parseBookList(loadFixture("books-global.html"), getAmazonRegion("global"));
    expect(jpBooks[0]?.lastAnnotatedAt).toBe("2026-07-15");
    expect(globalBooks[0]?.lastAnnotatedAt).toBe("2026-07-15");
  });
});
