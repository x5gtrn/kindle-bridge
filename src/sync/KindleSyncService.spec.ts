import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import { AmazonAuthUnsupportedError } from "../amazon/AmazonAuthService";
import { getAmazonRegion } from "../amazon/AmazonRegion";
import type { AmazonSessionService } from "../amazon/AmazonSessionService";
import { AmazonSessionExpiredError } from "../amazon/AmazonSessionService";
import {
  HttpTooManyRequestsError,
  TransientNetworkError,
  type KindleReaderClient,
} from "../amazon/KindleReaderClient";
import type { BookNoteWriter } from "../markdown/BookNoteRepository";
import { Logger } from "../utils/logger";
import { AmazonKindleSyncService, BookListFetchError } from "./KindleSyncService";

const FIXTURES_DIR = join(dirname(fileURLToPath(import.meta.url)), "../tests/fixtures");

function loadFixture(name: string): string {
  return readFileSync(join(FIXTURES_DIR, name), "utf8");
}

const booksHtml = loadFixture("books-jp.html");
const annotationsHtml = loadFixture("annotations-full.html");
const malformedAnnotationsHtml = loadFixture("annotations-malformed.html");
const region = getAmazonRegion("jp");

function fakeSessionService(valid: boolean): AmazonSessionService {
  return { isSessionValid: vi.fn().mockResolvedValue(valid) };
}

function fakeBookNoteWriter(): BookNoteWriter & { upsert: ReturnType<typeof vi.fn> } {
  return { upsert: vi.fn().mockResolvedValue("created") };
}

function buildService(overrides: {
  sessionValid?: boolean;
  readerClient: KindleReaderClient;
  bookNoteRepository?: BookNoteWriter;
}) {
  return new AmazonKindleSyncService({
    sessionService: fakeSessionService(overrides.sessionValid ?? true),
    readerClient: overrides.readerClient,
    bookNoteRepository: overrides.bookNoteRepository ?? fakeBookNoteWriter(),
    logger: new Logger({ level: "error" }),
    getDisplayCoverImage: () => true,
  });
}

describe("AmazonKindleSyncService", () => {
  it("throws AmazonSessionExpiredError and never fetches the book list when the session is invalid", async () => {
    const fetchBookListHtml = vi.fn();
    const service = buildService({
      sessionValid: false,
      readerClient: { fetchBookListHtml, fetchBookAnnotationsHtml: vi.fn() },
    });

    await expect(service.sync(region)).rejects.toThrow(AmazonSessionExpiredError);
    expect(fetchBookListHtml).not.toHaveBeenCalled();
  });

  it("wraps a book-list fetch failure in BookListFetchError", async () => {
    const service = buildService({
      readerClient: {
        fetchBookListHtml: vi.fn().mockRejectedValue(new Error("network down")),
        fetchBookAnnotationsHtml: vi.fn(),
      },
    });

    await expect(service.sync(region)).rejects.toThrow(BookListFetchError);
  });

  it("propagates a 429 from the book list fetch as-is (not wrapped) and stops immediately", async () => {
    const service = buildService({
      readerClient: {
        fetchBookListHtml: vi.fn().mockRejectedValue(new HttpTooManyRequestsError()),
        fetchBookAnnotationsHtml: vi.fn(),
      },
    });

    await expect(service.sync(region)).rejects.toThrow(HttpTooManyRequestsError);
  });

  it("syncs both books, isolating a per-book failure instead of stopping the whole sync", async () => {
    const bookNoteRepository = fakeBookNoteWriter();
    const fetchBookAnnotationsHtml = vi
      .fn()
      .mockImplementation((_region: unknown, asin: string) => {
        if (asin === "B0JPBOOK0001") {
          return Promise.resolve(annotationsHtml);
        }
        return Promise.reject(new Error("temporary glitch fetching this book"));
      });

    const service = buildService({
      readerClient: {
        fetchBookListHtml: vi.fn().mockResolvedValue(booksHtml),
        fetchBookAnnotationsHtml,
      },
      bookNoteRepository,
    });

    const result = await service.sync(region);

    expect(result.booksFound).toBe(2);
    expect(result.notesCreated).toBe(1);
    expect(result.errors).toBe(1);
    expect(bookNoteRepository.upsert).toHaveBeenCalledTimes(1);
    // annotations-full.html: 2 highlight-type (ann-1, ann-2) + (1 memo-attached-to-highlight + 1 standalone memo)
    expect(result.highlightsFetched).toBe(2);
    expect(result.memosFetched).toBe(2);
  });

  it("stops the whole sync immediately on a continuation-breaking error mid-loop", async () => {
    const fetchBookAnnotationsHtml = vi.fn().mockRejectedValue(new AmazonSessionExpiredError());
    const service = buildService({
      readerClient: {
        fetchBookListHtml: vi.fn().mockResolvedValue(booksHtml),
        fetchBookAnnotationsHtml,
      },
    });

    await expect(service.sync(region)).rejects.toThrow(AmazonSessionExpiredError);
    // Only the first book's annotations should have been attempted before aborting.
    expect(fetchBookAnnotationsHtml).toHaveBeenCalledTimes(1);
  });

  it("propagates AmazonAuthUnsupportedError as continuation-breaking", async () => {
    const service = buildService({
      readerClient: {
        fetchBookListHtml: vi.fn().mockResolvedValue(booksHtml),
        fetchBookAnnotationsHtml: vi.fn().mockRejectedValue(new AmazonAuthUnsupportedError()),
      },
    });

    await expect(service.sync(region)).rejects.toThrow(AmazonAuthUnsupportedError);
  });

  it("counts a book with zero parsed annotations as skipped, without writing a note", async () => {
    const bookNoteRepository = fakeBookNoteWriter();
    // Present container, but no `.kp-notebook-annotation` blocks inside.
    const noAnnotations = '<div id="kp-notebook-annotations"></div>';

    const service = buildService({
      readerClient: {
        fetchBookListHtml: vi.fn().mockResolvedValue(booksHtml),
        fetchBookAnnotationsHtml: vi.fn().mockResolvedValue(noAnnotations),
      },
      bookNoteRepository,
    });

    const result = await service.sync(region);

    expect(result.skipped).toBe(2);
    expect(bookNoteRepository.upsert).not.toHaveBeenCalled();
  });

  it("passes the live displayCoverImage setting through to the repository on each call", async () => {
    const bookNoteRepository = fakeBookNoteWriter();
    let displayCoverImage = true;
    const service = new AmazonKindleSyncService({
      sessionService: fakeSessionService(true),
      readerClient: {
        fetchBookListHtml: vi.fn().mockResolvedValue(booksHtml),
        fetchBookAnnotationsHtml: vi.fn().mockResolvedValue(annotationsHtml),
      },
      bookNoteRepository,
      logger: new Logger({ level: "error" }),
      getDisplayCoverImage: () => displayCoverImage,
    });

    displayCoverImage = false;
    await service.sync(region);

    expect(bookNoteRepository.upsert).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ displayCoverImage: false }),
    );
  });

  it("counts every book as a success when all books sync cleanly", async () => {
    const bookNoteRepository = fakeBookNoteWriter();
    const service = buildService({
      readerClient: {
        fetchBookListHtml: vi.fn().mockResolvedValue(booksHtml),
        fetchBookAnnotationsHtml: vi.fn().mockResolvedValue(annotationsHtml),
      },
      bookNoteRepository,
    });

    const result = await service.sync(region);

    expect(result.booksFound).toBe(2);
    expect(result.notesCreated).toBe(2);
    expect(result.notesUpdated).toBe(0);
    expect(result.errors).toBe(0);
    expect(result.skipped).toBe(0);
  });

  it("counts a repository 'updated' outcome as notesUpdated, not notesCreated", async () => {
    const bookNoteRepository = fakeBookNoteWriter();
    bookNoteRepository.upsert.mockResolvedValue("updated");
    const service = buildService({
      readerClient: {
        fetchBookListHtml: vi.fn().mockResolvedValue(booksHtml),
        fetchBookAnnotationsHtml: vi.fn().mockResolvedValue(annotationsHtml),
      },
      bookNoteRepository,
    });

    const result = await service.sync(region);

    expect(result.notesCreated).toBe(0);
    expect(result.notesUpdated).toBe(2);
  });

  it("isolates a TransientNetworkError (exhausted retries) to the one book, continuing the sync", async () => {
    const bookNoteRepository = fakeBookNoteWriter();
    const fetchBookAnnotationsHtml = vi
      .fn()
      .mockImplementation((_region: unknown, asin: string) => {
        if (asin === "B0JPBOOK0001") {
          return Promise.resolve(annotationsHtml);
        }
        return Promise.reject(new TransientNetworkError("connection reset"));
      });

    const service = buildService({
      readerClient: {
        fetchBookListHtml: vi.fn().mockResolvedValue(booksHtml),
        fetchBookAnnotationsHtml,
      },
      bookNoteRepository,
    });

    const result = await service.sync(region);

    expect(result.notesCreated).toBe(1);
    expect(result.errors).toBe(1);
  });

  it("isolates a KindleParseError (Amazon markup mismatch) to the one book, continuing the sync", async () => {
    const bookNoteRepository = fakeBookNoteWriter();
    const fetchBookAnnotationsHtml = vi
      .fn()
      .mockImplementation((_region: unknown, asin: string) => {
        if (asin === "B0JPBOOK0001") {
          return Promise.resolve(annotationsHtml);
        }
        // Triggers a real KindleParseError from parseAnnotations (missing
        // #kp-notebook-annotations container), exercising the same
        // per-book catch path as a fetch failure.
        return Promise.resolve(malformedAnnotationsHtml);
      });

    const service = buildService({
      readerClient: {
        fetchBookListHtml: vi.fn().mockResolvedValue(booksHtml),
        fetchBookAnnotationsHtml,
      },
      bookNoteRepository,
    });

    const result = await service.sync(region);

    expect(result.notesCreated).toBe(1);
    expect(result.errors).toBe(1);
  });
});
