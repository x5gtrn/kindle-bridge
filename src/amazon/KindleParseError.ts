/**
 * Thrown by KindleBookParser/KindleAnnotationParser when the fetched HTML
 * doesn't match the structure the parser expects. Callers should surface
 * this to the user as "Amazon's page structure may have changed" rather
 * than treating it like an empty result - see docs/architecture.md §6.
 */
export class KindleParseError extends Error {
  constructor(message: string) {
    super(`Amazon's page structure may have changed: ${message}`);
    this.name = "KindleParseError";
  }
}
