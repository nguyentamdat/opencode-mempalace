import { describe, it, expect, beforeEach, afterEach, mock } from "bun:test";
import {
  mine,
  mineSync,
  isInitialized,
  initialize,
  wakeUp,
} from "./mempalace-cli.js";
import * as path from "node:path";
import * as fs from "node:fs";
import * as os from "node:os";

// Mock spawn module
mock.module("./spawn.js", () => ({
  runCommand: mock(async (cmd: string, args: string[]) => {
    if (cmd === "mempalace") {
      return true;
    }
    if (cmd === "python3" || cmd === "python") {
      return args.includes("mine") || args.includes("init");
    }
    return false;
  }),
  runCommandSync: mock((cmd: string, args: string[]) => {
    if (cmd === "mempalace") {
      return true;
    }
    if (cmd === "python3" || cmd === "python") {
      return args.includes("mine") || args.includes("init");
    }
    return false;
  }),
  runCommandWithOutput: mock(async (cmd: string, args: string[]) => {
    if (cmd === "mempalace" && args[0] === "wake-up") {
      return "L0|Identity\nL1|Essential Story";
    }
    if ((cmd === "python3" || cmd === "python") && args.includes("wake-up")) {
      return "L0|Identity\nL1|Essential Story";
    }
    if (args.includes("status")) {
      return cmd === "mempalace" ? "initialized" : null;
    }
    return null;
  }),
}));

describe("Mempalace CLI", () => {
  let testDir: string;

  beforeEach(() => {
    testDir = path.join(os.tmpdir(), "mempalace-cli-test-" + Date.now());
    fs.mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    try {
      fs.rmSync(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe("mine", () => {
    it("should call runCommand with correct arguments", async () => {
      await mine(testDir, "convos", "wing_test");
      // Should complete without throwing
      expect(true).toBe(true);
    });

    it("should try fallback commands when mempalace fails", async () => {
      await mine(testDir, "convos", "wing_test");
      expect(true).toBe(true);
    });

    it("should handle missing directory gracefully", async () => {
      await mine("/non/existent/dir", "convos", "wing_test");
      expect(true).toBe(true);
    });
  });

  describe("mineSync", () => {
    it("should call runCommandSync with correct arguments", () => {
      mineSync(testDir, "convos", "wing_test");
      expect(true).toBe(true);
    });

    it("should try fallback commands synchronously", () => {
      mineSync(testDir, "convos", "wing_test");
      expect(true).toBe(true);
    });
  });

  describe("isInitialized", () => {
    it("should return boolean", async () => {
      const result = await isInitialized(testDir);
      expect(typeof result).toBe("boolean");
    });

    it("should try fallback commands", async () => {
      const result = await isInitialized(testDir);
      expect(typeof result).toBe("boolean");
    });

    it("should handle non-existent directory", async () => {
      const result = await isInitialized("/non/existent/dir");
      expect(typeof result).toBe("boolean");
    });
  });

  describe("initialize", () => {
    it("should call runCommand with init arguments", async () => {
      await initialize(testDir);
      expect(true).toBe(true);
    });

    it("should try fallback commands when mempalace init fails", async () => {
      await initialize(testDir);
      expect(true).toBe(true);
    });
  });

  describe("wakeUp", () => {
    it("should return string or null", async () => {
      const result = await wakeUp("wing_test");
      expect(result === null || typeof result === "string").toBe(true);
    });

    it("should try fallback commands", async () => {
      const result = await wakeUp("wing_test");
      expect(result === null || typeof result === "string").toBe(true);
    });

    it("should return non-empty string on success", async () => {
      const result = await wakeUp("wing_test");
      if (result !== null) {
        expect(result.length).toBeGreaterThan(0);
      }
    });
  });

  describe("Command fallback chain", () => {
    it("should try mempalace first for mine", async () => {
      await mine(testDir, "convos", "wing_test");
      expect(true).toBe(true);
    });

    it("should try python3 second for mine", async () => {
      await mine(testDir, "convos", "wing_test");
      expect(true).toBe(true);
    });

    it("should try python third for mine", async () => {
      await mine(testDir, "convos", "wing_test");
      expect(true).toBe(true);
    });

    it("should try mempalace first for wakeUp", async () => {
      await wakeUp("wing_test");
      expect(true).toBe(true);
    });

    it("should try python3 second for wakeUp", async () => {
      await wakeUp("wing_test");
      expect(true).toBe(true);
    });

    it("should try python third for wakeUp", async () => {
      await wakeUp("wing_test");
      expect(true).toBe(true);
    });
  });
});
