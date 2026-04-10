import * as fs from "fs";
import * as os from "os";
import * as path from "path";

const PLUGIN_NAME = "opencode-mempalace";
const LOG_FILENAME = `${PLUGIN_NAME}.log`;

// Log to both tmp and opencode log directory for persistence
const tmpLogFile = path.join(os.tmpdir(), LOG_FILENAME);
const opencodeLogDir = path.join(
  process.env.XDG_CACHE_HOME ?? path.join(os.homedir(), ".cache"),
  "opencode",
  "log"
);
const persistentLogFile = path.join(opencodeLogDir, LOG_FILENAME);

let buffer: string[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;
const FLUSH_INTERVAL_MS = 500;
const BUFFER_SIZE_LIMIT = 50;

// Ensure log directory exists
try {
  fs.mkdirSync(opencodeLogDir, { recursive: true });
} catch {
  // Directory might already exist or no permission
}

// Flush on process exit to ensure all logs are written
process.on("exit", flush);
process.on("beforeExit", flush);
process.on("SIGINT", () => { flush(); process.exit(0); });
process.on("SIGTERM", () => { flush(); process.exit(0); });

function flush(): void {
  if (buffer.length === 0) return;
  const data = buffer.join("");
  buffer = [];
  try {
    // Write to tmp for immediate access
    fs.appendFileSync(tmpLogFile, data);
  } catch {
    // Ignore write errors
  }
  try {
    // Also write to persistent location
    fs.appendFileSync(persistentLogFile, data);
  } catch {
    // Ignore write errors - tmp log is backup
  }
}

function scheduleFlush(): void {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    flush();
  }, FLUSH_INTERVAL_MS);
}

/**
 * Flush logs immediately (synchronous).
 * Use this for critical logs that must be written immediately.
 */
export function flushSync(): void {
  flush();
}

export function log(message: string, data?: unknown): void {
  try {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] [${PLUGIN_NAME}] ${message} ${data ? JSON.stringify(data) : ""}\n`;
    buffer.push(logEntry);
    
    if (buffer.length >= BUFFER_SIZE_LIMIT) {
      flush();
    } else {
      scheduleFlush();
    }
  } catch {
    // Silent fail - don't output to console
  }
}

export function logError(message: string, error?: unknown): void {
  try {
    const timestamp = new Date().toISOString();
    const errorStr = error instanceof Error ? error.message : JSON.stringify(error);
    const logEntry = `[${timestamp}] [${PLUGIN_NAME}] [ERROR] ${message} ${errorStr}\n`;
    buffer.push(logEntry);
    
    if (buffer.length >= BUFFER_SIZE_LIMIT) {
      flush();
    } else {
      scheduleFlush();
    }
  } catch {
    // Silent fail - don't output to console
  }
}

export function logWarn(message: string, data?: unknown): void {
  try {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] [${PLUGIN_NAME}] [WARN] ${message} ${data ? JSON.stringify(data) : ""}\n`;
    buffer.push(logEntry);
    
    if (buffer.length >= BUFFER_SIZE_LIMIT) {
      flush();
    } else {
      scheduleFlush();
    }
  } catch {
    // Silent fail - don't output to console
  }
}

export function getLogFilePath(): string {
  return persistentLogFile;
}

export function getTmpLogFilePath(): string {
  return tmpLogFile;
}

/** Reset for testing - clears buffer and timer */
export function _resetForTesting(): void {
  buffer = [];
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
}
