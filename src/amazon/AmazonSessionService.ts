import { NotImplementedYetError } from "../utils/errors";
import type { AmazonRegion } from "./AmazonRegion";

/**
 * Checks whether the current Amazon session (held entirely in Electron's
 * session partition, see AmazonAuthService) is still valid, without ever
 * reading or logging cookies/tokens directly. Implemented in Phase 3.
 */
export interface AmazonSessionService {
  isSessionValid(region: AmazonRegion): Promise<boolean>;
}

export class ElectronAmazonSessionService implements AmazonSessionService {
  isSessionValid(_region: AmazonRegion): Promise<boolean> {
    throw new NotImplementedYetError("Amazon session validation", "Phase 3");
  }
}
