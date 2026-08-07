import { describe, expect, it } from "vitest";
import { extractDevToolsUrl } from "./CdpBrowser";

describe("extractDevToolsUrl", () => {
  it("extracts the ws:// URL from Chrome's real stderr startup line", () => {
    const stderr =
      "[12345:0x0:INFO:CONSOLE] \n" +
      "DevTools listening on ws://127.0.0.1:54321/devtools/browser/1234abcd-5678-efgh-9012-ijklmnopqrst\n" +
      "[12345:0x0:INFO:CONSOLE] some other log line\n";
    expect(extractDevToolsUrl(stderr)).toBe(
      "ws://127.0.0.1:54321/devtools/browser/1234abcd-5678-efgh-9012-ijklmnopqrst",
    );
  });

  it("returns undefined when the line hasn't appeared yet", () => {
    expect(extractDevToolsUrl("[12345:0x0:INFO:CONSOLE] starting up...\n")).toBeUndefined();
  });

  it("returns undefined for empty input", () => {
    expect(extractDevToolsUrl("")).toBeUndefined();
  });

  it("stops the captured URL at the first whitespace", () => {
    const stderr = "DevTools listening on ws://127.0.0.1:9222/devtools/browser/id extra trailing text";
    expect(extractDevToolsUrl(stderr)).toBe("ws://127.0.0.1:9222/devtools/browser/id");
  });
});
