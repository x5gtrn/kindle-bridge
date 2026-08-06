export type LogLevel = "error" | "warn" | "info" | "debug";

const LEVEL_ORDER: Record<LogLevel, number> = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

/**
 * Keys whose values must never reach the log output, even when debug
 * logging is enabled. Matched case-insensitively against object keys
 * passed as log context.
 */
const SENSITIVE_KEY_PATTERN = /password|cookie|session|token|otp|auth|secret|credential/i;

const MASK = "[redacted]";

export interface LoggerOptions {
  level: LogLevel;
  sink?: (level: LogLevel, message: string) => void;
}

function maskSensitiveContext(context: unknown): unknown {
  if (Array.isArray(context)) {
    return context.map((entry) => maskSensitiveContext(entry));
  }
  if (context !== null && typeof context === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(context)) {
      result[key] = SENSITIVE_KEY_PATTERN.test(key) ? MASK : maskSensitiveContext(value);
    }
    return result;
  }
  return context;
}

/**
 * Leveled logger used throughout the plugin. Never pass raw Amazon
 * response bodies, cookies, tokens, or annotation text through this
 * logger — object context keys that look sensitive are masked, but the
 * caller is still responsible for not logging bulk user content.
 */
export class Logger {
  private level: LogLevel;
  private readonly sink: (level: LogLevel, message: string) => void;

  constructor(options: LoggerOptions) {
    this.level = options.level;
    this.sink = options.sink ?? Logger.defaultSink;
  }

  setLevel(level: LogLevel): void {
    this.level = level;
  }

  error(message: string, context?: Record<string, unknown>): void {
    this.log("error", message, context);
  }

  warn(message: string, context?: Record<string, unknown>): void {
    this.log("warn", message, context);
  }

  info(message: string, context?: Record<string, unknown>): void {
    this.log("info", message, context);
  }

  debug(message: string, context?: Record<string, unknown>): void {
    this.log("debug", message, context);
  }

  private log(level: LogLevel, message: string, context?: Record<string, unknown>): void {
    if (LEVEL_ORDER[level] > LEVEL_ORDER[this.level]) {
      return;
    }
    const maskedContext = context ? maskSensitiveContext(context) : undefined;
    const formatted = maskedContext ? `${message} ${JSON.stringify(maskedContext)}` : message;
    this.sink(level, `[Kindle Bridge] ${formatted}`);
  }

  private static defaultSink(this: void, level: LogLevel, message: string): void {
    switch (level) {
      case "error":
        console.error(message);
        return;
      case "warn":
        console.warn(message);
        return;
      default:
        console.log(message);
    }
  }
}
