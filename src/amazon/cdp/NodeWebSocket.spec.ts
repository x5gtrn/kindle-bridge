import { createHash } from "node:crypto";
import { createServer, type Server, type Socket } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { NodeWebSocket } from "./NodeWebSocket";

const WEBSOCKET_GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";

/**
 * These tests run NodeWebSocket against a real (if minimal) WebSocket
 * server built from scratch on a plain `net.createServer()` - not
 * against NodeWebSocket's own internals, so a bug shared between
 * "client" and "test helper" code can't hide a real protocol mismatch.
 * This is what actually gives confidence in a hand-rolled RFC 6455
 * implementation, given CdpConnection.ts depends on this working
 * correctly against Chrome's real DevTools WebSocket server - see
 * docs/architecture.md §4 for why the DOM `WebSocket` couldn't be used
 * instead.
 */

function computeAccept(key: string): string {
  return createHash("sha1")
    .update(key + WEBSOCKET_GUID)
    .digest("base64");
}

/** Server frames are sent unmasked, per RFC 6455 - only clients mask. */
function encodeServerFrame(opcode: number, payload: Buffer): Buffer {
  const finAndOpcode = 0x80 | opcode;
  let header: Buffer;
  if (payload.length < 126) {
    header = Buffer.from([finAndOpcode, payload.length]);
  } else if (payload.length < 65536) {
    header = Buffer.alloc(4);
    header[0] = finAndOpcode;
    header[1] = 126;
    header.writeUInt16BE(payload.length, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = finAndOpcode;
    header[1] = 127;
    header.writeBigUInt64BE(BigInt(payload.length), 2);
  }
  return Buffer.concat([header, payload]);
}

interface DecodedClientFrame {
  opcode: number;
  payload: Buffer;
}

/** Client frames are always masked - decodes exactly one frame from a
 * complete buffer (tests only ever send one frame per read here). */
function decodeClientFrame(buffer: Buffer): DecodedClientFrame {
  const opcode = buffer.readUInt8(0) & 0x0f;
  let payloadLength = buffer.readUInt8(1) & 0x7f;
  let offset = 2;
  if (payloadLength === 126) {
    payloadLength = buffer.readUInt16BE(offset);
    offset += 2;
  } else if (payloadLength === 127) {
    payloadLength = Number(buffer.readBigUInt64BE(offset));
    offset += 8;
  }
  const maskKey = buffer.subarray(offset, offset + 4);
  offset += 4;
  const masked = buffer.subarray(offset, offset + payloadLength);
  const payload = Buffer.alloc(masked.length);
  for (let i = 0; i < masked.length; i++) {
    payload.writeUInt8(masked.readUInt8(i) ^ maskKey.readUInt8(i % 4), i);
  }
  return { opcode, payload };
}

/** Starts a bare-bones WebSocket server: accepts the handshake for any
 * request, then hands the raw socket to `onConnection` for the test to
 * drive directly. Resolves with the port to connect to. */
async function startFakeWebSocketServer(
  onConnection: (socket: Socket) => void,
): Promise<{ server: Server; port: number }> {
  const server = createServer((socket) => {
    let buffer = "";
    const onData = (chunk: Buffer) => {
      buffer += chunk.toString("latin1");
      const headerEnd = buffer.indexOf("\r\n\r\n");
      if (headerEnd === -1) {
        return;
      }
      socket.off("data", onData);
      const keyMatch = /sec-websocket-key:\s*(\S+)/i.exec(buffer);
      const accept = computeAccept(keyMatch?.[1] ?? "");
      socket.write(
        "HTTP/1.1 101 Switching Protocols\r\n" +
          "Upgrade: websocket\r\n" +
          "Connection: Upgrade\r\n" +
          `Sec-WebSocket-Accept: ${accept}\r\n\r\n`,
      );
      onConnection(socket);
    };
    socket.on("data", onData);
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (address === null || typeof address === "string") {
    throw new Error("Expected a bound TCP address");
  }
  return { server, port: address.port };
}

function waitForEvent(socket: NodeWebSocket, type: string): Promise<unknown> {
  return new Promise((resolve) => socket.addEventListener(type, resolve, { once: true }));
}

describe("NodeWebSocket", () => {
  let servers: Server[] = [];

  afterEach(() => {
    servers.forEach((server) => server.close());
    servers = [];
  });

  it("completes the handshake and fires 'open'", async () => {
    const { server, port } = await startFakeWebSocketServer(() => undefined);
    servers.push(server);

    const socket = new NodeWebSocket(`ws://127.0.0.1:${port}/devtools/browser/test`);
    await waitForEvent(socket, "open");
    socket.close();
  });

  it("sends text frames the server can decode as masked WebSocket frames", async () => {
    let received: Promise<DecodedClientFrame> | undefined;
    const { server, port } = await startFakeWebSocketServer((serverSocket) => {
      received = new Promise((resolve) => {
        serverSocket.once("data", (chunk: Buffer) => resolve(decodeClientFrame(chunk)));
      });
    });
    servers.push(server);

    const socket = new NodeWebSocket(`ws://127.0.0.1:${port}/`);
    await waitForEvent(socket, "open");
    const message = JSON.stringify({ id: 1, method: "Page.enable" });
    socket.send(message);

    const frame = await received;
    expect(frame?.opcode).toBe(0x1);
    expect(frame?.payload.toString("utf8")).toBe(message);
  });

  it("receives a text frame from the server and fires 'message' with the decoded payload", async () => {
    let serverSocket: Socket | undefined;
    const { server, port } = await startFakeWebSocketServer((socket) => {
      serverSocket = socket;
    });
    servers.push(server);

    const socket = new NodeWebSocket(`ws://127.0.0.1:${port}/`);
    await waitForEvent(socket, "open");

    const messageEvent = waitForEvent(socket, "message");
    const payload = JSON.stringify({ method: "Page.frameNavigated", params: { url: "https://example.com" } });
    serverSocket?.write(encodeServerFrame(0x1, Buffer.from(payload, "utf8")));

    const event = await messageEvent;
    expect((event as { data: string }).data).toBe(payload);
  });

  it("round-trips a payload larger than 65535 bytes (extended 64-bit length)", async () => {
    let serverSocket: Socket | undefined;
    const { server, port } = await startFakeWebSocketServer((socket) => {
      serverSocket = socket;
    });
    servers.push(server);

    const socket = new NodeWebSocket(`ws://127.0.0.1:${port}/`);
    await waitForEvent(socket, "open");

    const largePayload = "x".repeat(200_000);
    const messageEvent = waitForEvent(socket, "message");
    serverSocket?.write(encodeServerFrame(0x1, Buffer.from(largePayload, "utf8")));

    const event = await messageEvent;
    expect((event as { data: string }).data).toBe(largePayload);
  });

  it("responds to a ping frame with a pong carrying the same payload", async () => {
    let serverSocket: Socket | undefined;
    const { server, port } = await startFakeWebSocketServer((socket) => {
      serverSocket = socket;
    });
    servers.push(server);

    const socket = new NodeWebSocket(`ws://127.0.0.1:${port}/`);
    await waitForEvent(socket, "open");

    const pongReceived = new Promise<DecodedClientFrame>((resolve) => {
      serverSocket?.on("data", (chunk: Buffer) => {
        const frame = decodeClientFrame(chunk);
        if (frame.opcode === 0xa) {
          resolve(frame);
        }
      });
    });
    serverSocket?.write(encodeServerFrame(0x9, Buffer.from("ping-payload", "utf8")));

    const pong = await pongReceived;
    expect(pong.payload.toString("utf8")).toBe("ping-payload");
  });
});
