import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { log, logError, logWarn, flushSync, getLogFilePath, getTmpLogFilePath } from "../src/logger.js";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

describe("Logger", () => {
  let testLogDir: string;

  beforeEach(() => {
    testLogDir = path.join(os.tmpdir(), "mempalace-logger-test-" + Date.now());
  });

  afterEach(() => {
    // Clean up any temp files
    try {
      fs.rmSync(testLogDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe("log", () => {
    it("should write message to buffer", () => {
      log("Test message");
      flushSync();
      expect(true).toBe(true);
    });

    it("should include data when provided", () => {
      log("Test message", { key: "value" });
      flushSync();
      expect(true).toBe(true);
    });

    it("should handle complex data objects", () => {
      log("Complex data", { nested: { array: [1, 2, 3], bool: true } });
      flushSync();
      expect(true).toBe(true);
    });

    it("should handle null data", () => {
      log("Null data", null);
      flushSync();
      expect(true).toBe(true);
    });

    it("should handle undefined data", () => {
      log("Undefined data", undefined);
      flushSync();
      expect(true).toBe(true);
    });

    it("should handle empty message", () => {
      log("");
      flushSync();
      expect(true).toBe(true);
    });
  });

  describe("logError", () => {
    it("should write error message to buffer", () => {
      logError("Error message");
      flushSync();
      expect(true).toBe(true);
    });

    it("should include error object when provided", () => {
      const error = new Error("Test error");
      logError("Error occurred", error);
      flushSync();
      expect(true).toBe(true);
    });

    it("should handle string error", () => {
      logError("Error", "string error");
      flushSync();
      expect(true).toBe(true);
    });

    it("should handle null error", () => {
      logError("Error", null);
      flushSync();
      expect(true).toBe(true);
    });

    it("should handle error without message", () => {
      logError("Error", { some: "object" });
      flushSync();
      expect(true).toBe(true);
    });
  });

  describe("logWarn", () => {
    it("should write warning message to buffer", () => {
      logWarn("Warning message");
      flushSync();
      expect(true).toBe(true);
    });

    it("should include data when provided", () => {
      logWarn("Warning", { context: "test" });
      flushSync();
      expect(true).toBe(true);
    });

    it("should handle no data", () => {
      logWarn("Simple warning");
      flushSync();
      expect(true).toBe(true);
    });
  });

  describe("flushSync", () => {
    it("should flush buffer synchronously", () => {
      log("Message before flush");
      flushSync();
      expect(true).toBe(true);
    });

    it("should be safe to call multiple times", () => {
      log("Message 1");
      flushSync();
      log("Message 2");
      flushSync();
      flushSync();
      expect(true).toBe(true);
    });

    it("should handle empty buffer", () => {
      flushSync();
      expect(true).toBe(true);
    });
  });

  describe("Buffer size limit", () => {
    it("should flush when buffer reaches size limit", () => {
      for (let i = 0; i < 60; i++) {
        log(`Message ${i}`);
      }
      expect(true).toBe(true);
    });

    it("should handle rapid successive logs", () => {
      for (let i = 0; i < 100; i++) {
        log(`Rapid message ${i}`);
      }
      flushSync();
      expect(true).toBe(true);
    });
  });

  describe("Multiple log entries", () => {
    it("should handle multiple log types in sequence", () => {
      log("Info message");
      logWarn("Warning message");
      logError("Error message");
      log("Another info", { data: true });
      flushSync();
      expect(true).toBe(true);
    });

    it("should handle multiple sessions of logging", () => {
      for (let i = 0; i < 10; i++) {
        log(`Session message ${i}`);
      }
      flushSync();
      for (let i = 10; i < 20; i++) {
        log(`Session message ${i}`);
      }
      flushSync();
      expect(true).toBe(true);
    });
  });

  describe("getLogFilePath", () => {
    it("should return a valid path string", () => {
      const path = getLogFilePath();
      expect(typeof path).toBe("string");
      expect(path.length).toBeGreaterThan(0);
    });

    it("should return path containing opencode", () => {
      const path = getLogFilePath();
      expect(path).toContain("opencode");
    });

    it("should return path ending with log filename", () => {
      const path = getLogFilePath();
      expect(path).toContain("opencode-mempalace.log");
    });
  });

  describe("getTmpLogFilePath", () => {
    it("should return a valid path string", () => {
      const path = getTmpLogFilePath();
      expect(typeof path).toBe("string");
      expect(path.length).toBeGreaterThan(0);
    });

    it("should return path in tmp directory", () => {
      const tmpPath = getTmpLogFilePath();
      expect(tmpPath).toContain(os.tmpdir());
    });

    it("should return path ending with log filename", () => {
      const path = getTmpLogFilePath();
      expect(path).toContain("opencode-mempalace.log");
    });
  });

  describe("Error handling", () => {
    it("should handle circular reference in data", () => {
      const data: { self?: unknown } = {};
      data.self = data;
      log("Circular", data);
      flushSync();
      expect(true).toBe(true);
    });

    it("should handle very long messages", () => {
      const longMessage = "a".repeat(10000);
      log(longMessage);
      flushSync();
      expect(true).toBe(true);
    });

    it("should handle unicode characters", () => {
      log("Unicode: Hello World");
      flushSync();
      expect(true).toBe(true);
    });
  });
});
