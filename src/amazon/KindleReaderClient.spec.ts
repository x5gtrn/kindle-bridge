import { describe, expect, it } from "vitest";
import { AmazonAuthUnsupportedError } from "./AmazonAuthService";
import { getAmazonRegion } from "./AmazonRegion";
import { ElectronKindleReaderClient } from "./KindleReaderClient";
import { Logger } from "../utils/logger";

describe("ElectronKindleReaderClient", () => {
  it("throws AmazonAuthUnsupportedError instead of crashing when Electron's remote bridge is unavailable", async () => {
    const region = getAmazonRegion("jp");
    // Separate client instances so each call's lastRequestAt starts at 0,
    // avoiding the real inter-request delay in this test.
    await expect(
      new ElectronKindleReaderClient(new Logger({ level: "error" })).fetchBookListHtml(region),
    ).rejects.toThrow(AmazonAuthUnsupportedError);
    await expect(
      new ElectronKindleReaderClient(new Logger({ level: "error" })).fetchBookAnnotationsHtml(
        region,
        "B012345678",
      ),
    ).rejects.toThrow(AmazonAuthUnsupportedError);
  });
});
