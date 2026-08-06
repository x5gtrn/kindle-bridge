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
      expect(book?.title).toBe("達人プログラマーへの道");
      expect(book?.authors).toEqual(["サンプル 太郎"]);
      expect(book?.coverImageUrl).toBe("https://m.media-amazon.com/images/I/jp-sample-cover-1.jpg");
      expect(book?.lastAnnotatedAt).toBe("2026-07-15");
      expect(book?.amazonUrl).toBe("https://www.amazon.co.jp/dp/B0JPBOOK0001");
      expect(book?.region).toBe("jp");
    });

    it("strips the Japanese author-name prefix", () => {
      expect(books[0]?.authors).not.toContain("著者： サンプル 太郎");
    });

    it("handles a book missing author, cover image, and last-annotated date", () => {
      const book = books[1];
      expect(book).toBeDefined();
      expect(book?.title).toBe("タイトルのみのサンプル書籍");
      expect(book?.authors).toEqual([]);
      expect(book?.coverImageUrl).toBeUndefined();
      expect(book?.lastAnnotatedAt).toBeUndefined();
    });
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
