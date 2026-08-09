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
 * Single entry point for manual sync. Owns only the re-entrancy lock
 * (spec: "do not run multiple syncs at the same time") so callers (commands,
 * ribbon icon) never need to worry about concurrent syncs themselves.
 * The sync service is passed in per call (rather than fixed at
 * construction) so the caller can build one from current settings
 * (output folder, display options) on every run without the lock itself
 * needing to know anything about that.
 */
export class SyncCoordinator {
  private syncInProgress = false;

  isSyncing(): boolean {
    return this.syncInProgress;
  }

  async sync(region: AmazonRegion, syncService: KindleSyncService): Promise<SyncResult> {
    if (this.syncInProgress) {
      throw new SyncAlreadyInProgressError();
    }
    this.syncInProgress = true;
    try {
      return await syncService.sync(region);
    } finally {
      this.syncInProgress = false;
    }
  }
}
