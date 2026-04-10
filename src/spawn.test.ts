import { describe, it, expect } from "bun:test";
import {
  isBunRuntime,
  spawnAsync,
  spawnSyncWrapper,
  runCommand,
  runCommandSync,
  runCommandWithOutput,
} from "./spawn.js";

describe("isBunRuntime", () => {
  it("should detect Bun runtime correctly", () => {
    const result = isBunRuntime();
    expect(typeof result).toBe("boolean");
  });
});

describe("spawnAsync", () => {
  it("should return exit code 0 for successful command", async () => {
    const result = await spawnAsync("echo", ["hello"]);
    expect(result.exitCode).toBe(0);
  });

  it("should return exit code 1 for failed command", async () => {
    const result = await spawnAsync("false", []);
    expect(result.exitCode).toBe(1);
  });

  it("should capture stdout when stdout is pipe", async () => {
    const result = await spawnAsync("echo", ["test output"], { stdout: "pipe" });
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBeDefined();
  });

  it("should handle command errors gracefully", async () => {
    const result = await spawnAsync("nonexistent_command_xyz", []);
    expect(result.exitCode).toBe(1);
  });

  it("should respect custom timeout", async () => {
    const start = Date.now();
    await spawnAsync("sleep", ["0.1"]);
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(500);
  });
});

describe("spawnSyncWrapper", () => {
  it("should return exit code 0 for successful command", () => {
    const result = spawnSyncWrapper("echo", ["hello"]);
    expect(result.exitCode).toBe(0);
  });

  it("should return exit code 1 for failed command", () => {
    const result = spawnSyncWrapper("false", []);
    expect(result.exitCode).toBe(1);
  });

  it("should handle command errors gracefully", () => {
    const result = spawnSyncWrapper("nonexistent_command_xyz", []);
    expect(result.exitCode).toBe(1);
  });
});

describe("runCommand", () => {
  it("should return true for successful command", async () => {
    const result = await runCommand("echo", ["hello"]);
    expect(result).toBe(true);
  });

  it("should return false for failed command", async () => {
    const result = await runCommand("false", []);
    expect(result).toBe(false);
  });
});

describe("runCommandSync", () => {
  it("should return true for successful command", () => {
    const result = runCommandSync("echo", ["hello"]);
    expect(result).toBe(true);
  });

  it("should return false for failed command", () => {
    const result = runCommandSync("false", []);
    expect(result).toBe(false);
  });
});

describe("runCommandWithOutput", () => {
  it("should return stdout for successful command", async () => {
    const result = await runCommandWithOutput("echo", ["test output"]);
    expect(result).toBe("test output");
  });

  it("should return null for failed command", async () => {
    const result = await runCommandWithOutput("false", []);
    expect(result).toBeNull();
  });
});
