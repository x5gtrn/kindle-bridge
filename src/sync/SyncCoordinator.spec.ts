import { describe, expect, it, vi } from "vitest";
import { getAmazonRegion } from "../amazon/AmazonRegion";
import { SyncAlreadyInProgressError, SyncCoordinator } from "./SyncCoordinator";
import { emptySyncResult } from "./SyncProgress";

describe("SyncCoordinator", () => {
  it("delegates to the sync service and releases the lock on success", async () => {
    const result = emptySyncResult();
    const syncService = { sync: vi.fn().mockResolvedValue(result) };
    const coordinator = new SyncCoordinator(syncService);

    const region = getAmazonRegion("jp");
    expect(coordinator.isSyncing()).toBe(false);
    const returned = await coordinator.sync(region);

    expect(returned).toBe(result);
    expect(syncService.sync).toHaveBeenCalledWith(region);
    expect(coordinator.isSyncing()).toBe(false);
  });

  it("releases the lock even when the sync service throws", async () => {
    const syncService = {
      sync: vi.fn().mockRejectedValue(new Error("boom")),
    };
    const coordinator = new SyncCoordinator(syncService);

    await expect(coordinator.sync(getAmazonRegion("jp"))).rejects.toThrow("boom");
    expect(coordinator.isSyncing()).toBe(false);
  });

  it("rejects a second concurrent sync while one is in flight", async () => {
    let resolveFirst: (() => void) | undefined;
    const inFlight = new Promise<void>((resolve) => {
      resolveFirst = resolve;
    });
    const syncService = {
      sync: vi.fn().mockImplementation(async () => {
        await inFlight;
        return emptySyncResult();
      }),
    };
    const coordinator = new SyncCoordinator(syncService);
    const region = getAmazonRegion("jp");

    const first = coordinator.sync(region);
    expect(coordinator.isSyncing()).toBe(true);

    await expect(coordinator.sync(region)).rejects.toThrow(SyncAlreadyInProgressError);

    resolveFirst?.();
    await first;
    expect(coordinator.isSyncing()).toBe(false);
  });
});
