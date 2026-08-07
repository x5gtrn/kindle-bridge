import { AmazonAuthUnsupportedError } from "../amazon/AmazonAuthService";
import type { AmazonRegion } from "../amazon/AmazonRegion";
import {
  AmazonSessionExpiredError,
  type AmazonSessionService,
} from "../amazon/AmazonSessionService";
import { HttpTooManyRequestsError, type KindleReaderClient } from "../amazon/KindleReaderClient";
import { parseAnnotations } from "../amazon/KindleAnnotationParser";
import { parseBookList } from "../amazon/KindleBookParser";
import type { BookNoteWriter } from "../markdown/BookNoteRepository";
import type { KindleAnnotation } from "../models/KindleAnnotation";
import type { KindleBook } from "../models/KindleBook";
import { nowIsoTimestamp } from "../utils/dates";
import type { Logger } from "../utils/logger";
import { emptySyncResult, type SyncResult } from "./SyncProgress";

/**
 * Orchestrates fetching books/annotations from Amazon, normalizing them,
 * and persisting book notes via the markdown layer - the full manual
 * sync flow from docs/architecture.md §"手動同期フロー" (session check ->
 * book list -> per-book annotations -> render -> save -> SyncResult).
 * SyncCoordinator only adds the single-flight lock around this.
 */
export interface KindleSyncService {
  sync(region: AmazonRegion): Promise<SyncResult>;
}

export class BookListFetchError extends Error {
  constructor(cause: unknown) {
    super(`Could not fetch the Kindle book list: ${describeCause(cause)}`);
    this.name = "BookListFetchError";
  }
}

export interface AmazonKindleSyncServiceDeps {
  sessionService: AmazonSessionService;
  readerClient: KindleReaderClient;
  bookNoteRepository: BookNoteWriter;
  logger: Logger;
  /** Read live rather than captured once, so a settings change takes
   * effect on the next sync without needing to rebuild this service. */
  getDisplayCoverImage: () => boolean;
}

export class AmazonKindleSyncService implements KindleSyncService {
  constructor(private readonly deps: AmazonKindleSyncServiceDeps) {}

  async sync(region: AmazonRegion): Promise<SyncResult> {
    this.deps.logger.info("Sync started", { region: region.id });
    const result = emptySyncResult();

    const sessionValid = await this.deps.sessionService.isSessionValid(region);
    if (!sessionValid) {
      throw new AmazonSessionExpiredError();
    }

    const books = await this.fetchBookList(region);
    result.booksFound = books.length;
    this.deps.logger.info(`Found ${books.length} book(s)`);

    for (const [index, book] of books.entries()) {
      this.deps.logger.info(`Syncing book ${index + 1}/${books.length}: "${book.title}"`);
      await this.syncOneBook(book, region, result);
    }

    this.deps.logger.info("Sync finished", {
      notesCreated: result.notesCreated,
      notesUpdated: result.notesUpdated,
      skipped: result.skipped,
      errors: result.errors,
    });
    return result;
  }

  private async fetchBookList(region: AmazonRegion): Promise<KindleBook[]> {
    this.deps.logger.info("Fetching Kindle book list...");
    try {
      const html = await this.deps.readerClient.fetchBookListHtml(region);
      return parseBookList(html, region);
    } catch (error) {
      if (isContinuationBreakingError(error)) {
        throw error;
      }
      throw new BookListFetchError(error);
    }
  }

  private async syncOneBook(
    book: KindleBook,
    region: AmazonRegion,
    result: SyncResult,
  ): Promise<void> {
    try {
      const annotations = await this.fetchBookAnnotations(book, region);
      result.highlightsFetched += annotations.filter((a) => a.type === "highlight").length;
      result.memosFetched += countMemos(annotations);

      if (annotations.length === 0) {
        result.skipped += 1;
        return;
      }

      const outcome = await this.deps.bookNoteRepository.upsert(book, annotations, {
        displayCoverImage: this.deps.getDisplayCoverImage(),
        syncedAt: nowIsoTimestamp(),
      });
      if (outcome === "created") {
        result.notesCreated += 1;
      } else {
        result.notesUpdated += 1;
      }
    } catch (error) {
      if (isContinuationBreakingError(error)) {
        throw error;
      }
      this.deps.logger.warn(`Failed to sync book "${book.title}"`, {
        bookId: book.id,
        message: describeCause(error),
      });
      result.errors += 1;
    }
  }

  private async fetchBookAnnotations(
    book: KindleBook,
    region: AmazonRegion,
  ): Promise<KindleAnnotation[]> {
    const html = await this.deps.readerClient.fetchBookAnnotationsHtml(
      region,
      book.asin ?? book.id,
    );
    return parseAnnotations(html, book.id, region);
  }
}

function countMemos(annotations: KindleAnnotation[]): number {
  return annotations.filter((a) => a.type === "memo" || a.memo !== undefined).length;
}

/** Errors that make the rest of the sync pointless or unsafe to
 * continue (spec: "認証切れなど、継続不能なエラーの場合のみ全体を停止") -
 * everything else is scoped to the one book/request that failed. */
function isContinuationBreakingError(error: unknown): boolean {
  return (
    error instanceof AmazonSessionExpiredError ||
    error instanceof AmazonAuthUnsupportedError ||
    error instanceof HttpTooManyRequestsError
  );
}

function describeCause(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
