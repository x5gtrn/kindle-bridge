/**
 * Minimal Chrome DevTools Protocol client: a thin JSON-RPC-over-
 * WebSocket layer, just enough for the Target/Page/Runtime domains
 * CdpBrowser.ts needs. Deliberately hand-rolled rather than depending
 * on a library like chrome-remote-interface, puppeteer-core, or
 * playwright-core - see docs/risks.md R-05 for why Playwright
 * specifically was ruled out (its own runtime file-path assumptions
 * don't survive esbuild bundling into a single main.js, which
 * Obsidian Community Plugins require).
 */

interface PendingRequest {
  method: string;
  resolve: (result: unknown) => void;
  reject: (error: Error) => void;
}

interface CdpErrorPayload {
  code: number;
  message: string;
}

interface CdpMessage {
  id?: number;
  method?: string;
  params?: unknown;
  result?: unknown;
  error?: CdpErrorPayload;
  sessionId?: string;
}

export class CdpProtocolError extends Error {
  constructor(method: string, cause: CdpErrorPayload) {
    super(`CDP command "${method}" failed: ${cause.message} (code ${cause.code})`);
    this.name = "CdpProtocolError";
  }
}

export class CdpUnsupportedError extends Error {
  constructor() {
    super("WebSocket is not available in this Obsidian/Electron/Node runtime.");
    this.name = "CdpUnsupportedError";
  }
}

export class CdpConnection {
  private nextId = 1;
  private readonly pending = new Map<number, PendingRequest>();
  private readonly eventListeners = new Map<string, Set<(params: unknown) => void>>();

  private constructor(private readonly socket: WebSocket) {
    this.socket.addEventListener("message", (event: MessageEvent<unknown>) => {
      this.handleMessage(String(event.data));
    });
  }

  /** For tests: wraps an already-open (real or fake) WebSocket-like
   * object directly, skipping the "wait for open" handshake connect()
   * performs - lets the JSON-RPC framing logic in this class be
   * unit-tested without a real network connection. */
  static fromSocket(socket: WebSocket): CdpConnection {
    return new CdpConnection(socket);
  }

  static connect(webSocketUrl: string): Promise<CdpConnection> {
    if (typeof WebSocket === "undefined") {
      return Promise.reject(new CdpUnsupportedError());
    }
    return new Promise((resolve, reject) => {
      const socket = new WebSocket(webSocketUrl);
      const onOpen = () => {
        socket.removeEventListener("error", onError);
        resolve(new CdpConnection(socket));
      };
      const onError = () => {
        socket.removeEventListener("open", onOpen);
        reject(new Error(`Could not connect to ${webSocketUrl}`));
      };
      socket.addEventListener("open", onOpen, { once: true });
      socket.addEventListener("error", onError, { once: true });
    });
  }

  send<T = unknown>(
    method: string,
    params: Record<string, unknown> = {},
    sessionId?: string,
  ): Promise<T> {
    const id = this.nextId++;
    const message: CdpMessage = { id, method, params };
    if (sessionId) {
      message.sessionId = sessionId;
    }
    return new Promise((resolve, reject) => {
      this.pending.set(id, {
        method,
        resolve: resolve as (result: unknown) => void,
        reject,
      });
      this.socket.send(JSON.stringify(message));
    });
  }

  on(event: string, listener: (params: unknown) => void): void {
    const listeners = this.eventListeners.get(event) ?? new Set();
    listeners.add(listener);
    this.eventListeners.set(event, listeners);
  }

  off(event: string, listener: (params: unknown) => void): void {
    this.eventListeners.get(event)?.delete(listener);
  }

  close(): void {
    this.socket.close();
  }

  private handleMessage(raw: string): void {
    let message: CdpMessage;
    try {
      message = JSON.parse(raw) as CdpMessage;
    } catch {
      return;
    }

    if (typeof message.id === "number") {
      const pending = this.pending.get(message.id);
      if (!pending) {
        return;
      }
      this.pending.delete(message.id);
      if (message.error) {
        pending.reject(new CdpProtocolError(pending.method, message.error));
      } else {
        pending.resolve(message.result);
      }
      return;
    }

    if (typeof message.method === "string") {
      const listeners = this.eventListeners.get(message.method);
      listeners?.forEach((listener) => listener(message.params));
    }
  }
}
