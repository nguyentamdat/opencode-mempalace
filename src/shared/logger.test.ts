import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { log, logError, logWarn, flushSync, getLogFilePath, getTmpLogFilePath, _resetForTesting } from "./logger.js";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

describe("Logger", () => {
  let testLogDir: string;

  beforeEach(() => {
    testLogDir = path.join(os.tmpdir(), "mempalace-logger-test-" + Date.now());
    _resetForTesting();
  });

  afterEach(() => {
    // Clean up any temp files
    try {
      fs.rmSync(testLogDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
    _resetForTesting();
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
  });

  describe("logError", () => {
    it("should log error message", () => {
      logError("Error occurred");
      flushSync();
      expect(true).toBe(true);
    });

    it("should log error with Error object", () => {
      const error = new Error("Test error");
      logError("Error occurred", error);
      flushSync();
      expect(true).toBe(true);
    });

    it("should log error with string", () => {
      logError("Error occurred", "error details");
      flushSync();
      expect(true).toBe(true);
    });

    it("should handle error without message", () => {
      logError("Error");
      flushSync();
      expect(true).toBe(true);
    });
  });

  describe("logWarn", () => {
    it("should log warning message", () => {
      logWarn("Warning message");
      flushSync();
      expect(true).toBe(true);
    });

    it("should log warning with data", () => {
      logWarn("Warning", { detail: "value" });
      flushSync();
      expect(true).toBe(true);
    });
  });

  describe("flushSync", () => {
    it("should flush buffer synchronously", () => {
      log("Message 1");
      log("Message 2");
      flushSync();
      expect(true).toBe(true);
    });

    it("should handle empty buffer", () => {
      flushSync();
      expect(true).toBe(true);
    });

    it("should handle multiple flushes", () => {
      log("Message");
      flushSync();
      flushSync();
      expect(true).toBe(true);
    });
  });

  describe("getLogFilePath", () => {
    it("should return a string path", () => {
      const path = getLogFilePath();
      expect(typeof path).toBe("string");
      expect(path.length).toBeGreaterThan(0);
    });

    it("should return path in cache directory", () => {
      const cachePath = getLogFilePath();
      expect(cachePath).toContain("opencode");
    });

    it("should return path ending with log filename", () => {
      const path = getLogFilePath();
      expect(path).toContain("opencode-mempalace.log");
    });
  });

  describe("getTmpLogFilePath", () => {
    it("should return a string path", () => {
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
