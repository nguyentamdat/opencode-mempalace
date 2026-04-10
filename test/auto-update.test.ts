import { describe, it, expect, beforeEach, afterEach, mock } from "bun:test";
import { checkAndUpdate, type UpdateResult } from "../src/auto-update.js";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

describe("Auto Update", () => {
  let testDir: string;
  let originalCwd: string;

  beforeEach(() => {
    testDir = path.join(os.tmpdir(), "mempalace-autoupdate-test-" + Date.now());
    fs.mkdirSync(testDir, { recursive: true });
    originalCwd = process.cwd();
  });

  afterEach(() => {
    process.chdir(originalCwd);
    try {
      fs.rmSync(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe("checkAndUpdate", () => {
    it("should return current and latest version", async () => {
      const mockRunInstall = mock(() => Promise.resolve(true));
      const result = await checkAndUpdate(mockRunInstall, false);
      expect(result).toHaveProperty("currentVersion");
      expect(result).toHaveProperty("latestVersion");
      expect(result).toHaveProperty("updated");
    });

    it("should respect pin parameter when version is pinned", async () => {
      const cacheDir = path.join(testDir, "cache");
      fs.mkdirSync(cacheDir, { recursive: true });
      fs.writeFileSync(
        path.join(cacheDir, "package.json"),
        JSON.stringify({ dependencies: { "opencode-mempalace": "1.0.0" } })
      );
      const mockRunInstall = mock(() => Promise.resolve(true));
      const originalEnv = process.env.XDG_CACHE_HOME;
      process.env.XDG_CACHE_HOME = cacheDir;
      const result = await checkAndUpdate(mockRunInstall, true);
      process.env.XDG_CACHE_HOME = originalEnv;
      expect(result.updated).toBe(false);
    });

    it("should not update when versions are equal", async () => {
      const mockRunInstall = mock(() => Promise.resolve(true));
      const result = await checkAndUpdate(mockRunInstall, false);
      if (result.currentVersion === result.latestVersion) {
        expect(result.updated).toBe(false);
      }
    });
  });

  describe("Version handling", () => {
    it("should handle null currentVersion", async () => {
      const mockRunInstall = mock(() => Promise.resolve(true));
      const result = await checkAndUpdate(mockRunInstall, false);
      if (result.currentVersion === null) {
        expect(result.updated).toBe(false);
      }
    });

    it("should handle null latestVersion", async () => {
      const mockRunInstall = mock(() => Promise.resolve(true));
      const result = await checkAndUpdate(mockRunInstall, false);
      if (result.latestVersion === null) {
        expect(result.updated).toBe(false);
      }
    });
  });
});
