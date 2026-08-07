/**
 * Bounds an otherwise-unbounded promise (e.g. waiting on a CDP event
 * that might never fire) so a single stuck operation can't hang a sync
 * forever - SyncCoordinator's re-entrancy lock only ever clears when
 * the in-flight sync's promise settles, so an unbounded wait anywhere
 * in that chain would leave every later "Sync now" permanently
 * rejected with SyncAlreadyInProgressError, with no way to recover
 * short of restarting Obsidian.
 */
export class TimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TimeoutError";
  }
}

export function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new TimeoutError(message)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error instanceof Error ? error : new Error(String(error)));
      },
    );
  });
}
