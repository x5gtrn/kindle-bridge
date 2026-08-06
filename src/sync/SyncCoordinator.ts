import type { AmazonRegion } from "../amazon/AmazonRegion";
import type { KindleSyncService } from "./KindleSyncService";
import type { SyncResult } from "./SyncProgress";

export class SyncAlreadyInProgressError extends Error {
  constructor() {
    super("A Kindle Bridge sync is already in progress.");
    this.name = "SyncAlreadyInProgressError";
  }
}

/**
 * Single entry point for manual sync. Owns the re-entrancy lock (spec:
 * "同時に複数の同期を実行しないでください") so callers (commands, ribbon
 * icon) never need to worry about concurrent syncs themselves. Delegates
 * the actual fetch/parse/render/save flow to KindleSyncService.
 */
export class SyncCoordinator {
  private syncInProgress = false;

  constructor(private readonly syncService: KindleSyncService) {}

  isSyncing(): boolean {
    return this.syncInProgress;
  }

  async sync(region: AmazonRegion): Promise<SyncResult> {
    if (this.syncInProgress) {
      throw new SyncAlreadyInProgressError();
    }
    this.syncInProgress = true;
    try {
      return await this.syncService.sync(region);
    } finally {
      this.syncInProgress = false;
    }
  }
}
