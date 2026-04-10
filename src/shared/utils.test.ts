import { describe, it, expect } from "bun:test";
import { getWingFromPath, isEmptyWorkspace } from "./utils.js";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

describe("getWingFromPath", () => {
  it("should return wing_general for root path", () => {
    expect(getWingFromPath("/")).toBe("wing_general");
  });

  it("should return wing_general for empty path", () => {
    expect(getWingFromPath("")).toBe("wing_general");
  });

  it("should sanitize workspace name", () => {
    expect(getWingFromPath("/home/dat/opencode-mempalace")).toBe("wing_opencode-mempalace");
  });

  it("should replace non-alphanumeric with hyphens", () => {
    expect(getWingFromPath("/home/dat/My Project")).toBe("wing_my-project");
  });

  it("should handle special characters", () => {
    expect(getWingFromPath("/projects/test_app.v2")).toBe("wing_test-app-v2");
  });
});

describe("isEmptyWorkspace", () => {
  const testDir = path.join(os.tmpdir(), "mempalace-test-" + Date.now());

  it("should return true for non-existent directory", () => {
    expect(isEmptyWorkspace("/non/existent/path")).toBe(true);
  });

  it("should return true for empty directory", () => {
    fs.mkdirSync(testDir, { recursive: true });
    expect(isEmptyWorkspace(testDir)).toBe(true);
    fs.rmdirSync(testDir);
  });

  it("should return true for directory with only ignored files", () => {
    fs.mkdirSync(testDir, { recursive: true });
    fs.mkdirSync(path.join(testDir, ".git"), { recursive: true });
    fs.mkdirSync(path.join(testDir, "node_modules"), { recursive: true });
    expect(isEmptyWorkspace(testDir)).toBe(true);
    
    // Cleanup
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  it("should return false for directory with meaningful files", () => {
    fs.mkdirSync(testDir, { recursive: true });
    fs.writeFileSync(path.join(testDir, "README.md"), "# Test");
    expect(isEmptyWorkspace(testDir)).toBe(false);
    
    // Cleanup
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  it("should return false for directory with code files", () => {
    fs.mkdirSync(testDir, { recursive: true });
    fs.writeFileSync(path.join(testDir, "index.ts"), "console.log('test');");
    expect(isEmptyWorkspace(testDir)).toBe(false);
    
    // Cleanup
    fs.rmSync(testDir, { recursive: true, force: true });
  });
});
