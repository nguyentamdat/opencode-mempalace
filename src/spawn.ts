/**
 * Runtime-agnostic spawn utilities.
 * Works with both Bun and Node.js runtimes.
 * Prefers Bun.spawn when available, falls back to child_process.
 */

import { spawn, spawnSync } from "node:child_process";

const CLI_TIMEOUT_MS = 5000;

/**
 * Check if running in Bun runtime
 */
export function isBunRuntime(): boolean {
  return typeof Bun !== "undefined" && Bun.spawn !== undefined;
}

/**
 * Spawn a process asynchronously (runtime-agnostic)
 */
export async function spawnAsync(
  cmd: string,
  args: string[],
  options: {
    timeout?: number;
    stdout?: "pipe" | "ignore";
    stderr?: "pipe" | "ignore";
  } = {}
): Promise<{ exitCode: number; stdout?: string }> {
  const timeout = options.timeout ?? CLI_TIMEOUT_MS;
  const stdout = options.stdout ?? "ignore";
  const stderr = options.stderr ?? "ignore";

  // Use Bun.spawn if available
  if (isBunRuntime()) {
    try {
      const proc = Bun.spawn([cmd, ...args], {
        stdout,
        stderr,
        timeout,
      });

      let output = "";
      if (stdout === "pipe" && proc.stdout) {
        output = await new Response(proc.stdout).text();
      }

      await proc.exited;
      return { exitCode: proc.exitCode ?? 1, stdout: output };
    } catch {
      return { exitCode: 1 };
    }
  }

  // Fallback to Node.js child_process
  return new Promise((resolve) => {
    const proc = spawn(cmd, args, {
      stdio: [
        "ignore",
        stdout === "pipe" ? "pipe" : "ignore",
        stderr === "pipe" ? "pipe" : "ignore",
      ],
      timeout,
    });

    let output = "";
    if (stdout === "pipe" && proc.stdout) {
      proc.stdout.on("data", (data) => {
        output += data.toString();
      });
    }

    proc.on("close", (code) => {
      resolve({ exitCode: code ?? 1, stdout: output });
    });

    proc.on("error", () => {
      resolve({ exitCode: 1 });
    });
  });
}

/**
 * Spawn a process synchronously (runtime-agnostic)
 */
export function spawnSyncWrapper(
  cmd: string,
  args: string[],
  options: {
    timeout?: number;
    stdout?: "pipe" | "ignore";
    stderr?: "pipe" | "ignore";
  } = {}
): { exitCode: number; stdout?: string } {
  const timeout = options.timeout ?? CLI_TIMEOUT_MS;
  const stdout = options.stdout ?? "ignore";
  const stderr = options.stderr ?? "ignore";

  // Use Bun.spawnSync if available
  if (isBunRuntime()) {
    try {
      const result = Bun.spawnSync([cmd, ...args], {
        stdout,
        stderr,
        timeout,
      });
      return { exitCode: result.exitCode ?? 1 };
    } catch {
      return { exitCode: 1 };
    }
  }

  // Fallback to Node.js child_process
  try {
    const result = spawnSync(cmd, args, {
      stdio: [
        "ignore",
        stdout === "pipe" ? "pipe" : "ignore",
        stderr === "pipe" ? "pipe" : "ignore",
      ],
      timeout,
      encoding: stdout === "pipe" ? "utf-8" : undefined,
    });
    return { exitCode: result.status ?? 1, stdout: result.stdout?.toString() };
  } catch {
    return { exitCode: 1 };
  }
}

/**
 * Run a command and return true if successful (async)
 */
export async function runCommand(cmd: string, args: string[], timeout?: number): Promise<boolean> {
  const result = await spawnAsync(cmd, args, {
    timeout,
    stdout: "ignore",
    stderr: "ignore",
  });
  return result.exitCode === 0;
}

/**
 * Run a command and return true if successful (sync)
 */
export function runCommandSync(cmd: string, args: string[], timeout?: number): boolean {
  const result = spawnSyncWrapper(cmd, args, {
    timeout,
    stdout: "ignore",
    stderr: "ignore",
  });
  return result.exitCode === 0;
}

/**
 * Run a command and return stdout if successful (async)
 */
export async function runCommandWithOutput(
  cmd: string,
  args: string[],
  timeout?: number
): Promise<string | null> {
  const result = await spawnAsync(cmd, args, {
    timeout,
    stdout: "pipe",
    stderr: "ignore",
  });
  if (result.exitCode === 0 && result.stdout) {
    return result.stdout.trim();
  }
  return null;
}
