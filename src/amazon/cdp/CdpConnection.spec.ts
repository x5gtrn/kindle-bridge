import { describe, expect, it, vi } from "vitest";
import { CdpConnection, CdpProtocolError } from "./CdpConnection";

type Listener = (event: { data: string }) => void;

/** Minimal fake satisfying just the WebSocket surface CdpConnection
 * uses, so its JSON-RPC framing logic can be tested without a real
 * network connection - see CdpConnection.fromSocket(). */
function fakeSocket() {
  const messageListeners = new Set<Listener>();
  const sent: string[] = [];

  const socket = {
    send: (data: string) => {
      sent.push(data);
    },
    close: () => undefined,
    addEventListener: (event: string, listener: Listener) => {
      if (event === "message") {
        messageListeners.add(listener);
      }
    },
    removeEventListener: (event: string, listener: Listener) => {
      if (event === "message") {
        messageListeners.delete(listener);
      }
    },
  } as unknown as WebSocket;

  return {
    socket,
    sent,
    /** Simulates the server sending a CDP message down the socket. */
    emitMessage: (payload: unknown) => {
      const data = JSON.stringify(payload);
      messageListeners.forEach((listener) => listener({ data }));
    },
    lastSentMessage: (): { id: number; method: string; params: unknown } =>
      JSON.parse(sent[sent.length - 1] ?? "{}") as { id: number; method: string; params: unknown },
  };
}

describe("CdpConnection", () => {
  it("sends a JSON-RPC request with an incrementing id and resolves on a matching response", async () => {
    const fake = fakeSocket();
    const connection = CdpConnection.fromSocket(fake.socket);

    const promise = connection.send("Page.navigate", { url: "https://example.com" });
    const request = fake.lastSentMessage();
    expect(request.method).toBe("Page.navigate");
    expect(request.params).toEqual({ url: "https://example.com" });

    fake.emitMessage({ id: request.id, result: { frameId: "abc" } });

    await expect(promise).resolves.toEqual({ frameId: "abc" });
  });

  it("rejects with CdpProtocolError when the response carries an error", async () => {
    const fake = fakeSocket();
    const connection = CdpConnection.fromSocket(fake.socket);

    const promise = connection.send("Page.navigate", { url: "not-a-url" });
    const request = fake.lastSentMessage();

    fake.emitMessage({ id: request.id, error: { code: -32000, message: "Invalid URL" } });

    await expect(promise).rejects.toThrow(CdpProtocolError);
    await expect(promise).rejects.toThrow(/Invalid URL/);
  });

  it("assigns a distinct, incrementing id to each request", () => {
    const fake = fakeSocket();
    const connection = CdpConnection.fromSocket(fake.socket);

    void connection.send("Page.enable");
    const first = fake.lastSentMessage();
    void connection.send("Runtime.enable");
    const second = fake.lastSentMessage();

    expect(second.id).toBeGreaterThan(first.id);
  });

  it("includes sessionId on the outgoing message when provided", () => {
    const fake = fakeSocket();
    const connection = CdpConnection.fromSocket(fake.socket);

    void connection.send("Page.navigate", { url: "https://example.com" }, "session-1");

    const sent = JSON.parse(fake.sent[0] ?? "{}") as { sessionId?: string };
    expect(sent.sessionId).toBe("session-1");
  });

  it("dispatches event messages (no id) to matching on() listeners", () => {
    const fake = fakeSocket();
    const connection = CdpConnection.fromSocket(fake.socket);
    const listener = vi.fn();
    connection.on("Page.frameNavigated", listener);

    fake.emitMessage({
      method: "Page.frameNavigated",
      params: { frame: { url: "https://example.com", parentId: undefined } },
    });

    expect(listener).toHaveBeenCalledWith({
      frame: { url: "https://example.com", parentId: undefined },
    });
  });

  it("does not call a listener after off() removes it", () => {
    const fake = fakeSocket();
    const connection = CdpConnection.fromSocket(fake.socket);
    const listener = vi.fn();
    connection.on("Page.frameNavigated", listener);
    connection.off("Page.frameNavigated", listener);

    fake.emitMessage({ method: "Page.frameNavigated", params: {} });

    expect(listener).not.toHaveBeenCalled();
  });

  it("ignores malformed (non-JSON) messages instead of throwing", () => {
    const fake = fakeSocket();
    CdpConnection.fromSocket(fake.socket);

    // JSON.stringify(undefined) is the JS value `undefined`, which
    // String()-coerces to the text "undefined" - not valid JSON.
    expect(() => fake.emitMessage(undefined)).not.toThrow();
  });
});
