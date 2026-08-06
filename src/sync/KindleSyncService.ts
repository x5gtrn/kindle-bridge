import { NotImplementedYetError } from "../utils/errors";
import type { AmazonRegion } from "../amazon/AmazonRegion";
import type { SyncResult } from "./SyncProgress";

/**
 * Orchestrates fetching books/annotations from Amazon, normalizing them,
 * and persisting book notes via the markdown layer. This is where the
 * full manual-sync flow (session check -> book list -> per-book
 * annotations -> normalize -> render -> save) lives once implemented in
 * Phase 3. SyncCoordinator only adds the single-flight lock around it.
 */
export interface KindleSyncService {
  sync(region: AmazonRegion): Promise<SyncResult>;
}

export class NotImplementedKindleSyncService implements KindleSyncService {
  sync(_region: AmazonRegion): Promise<SyncResult> {
    throw new NotImplementedYetError("Kindle sync", "Phase 3");
  }
}
