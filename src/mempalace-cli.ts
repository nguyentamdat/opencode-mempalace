/**
 * Thin wrapper around the `mempalace` CLI for background auto-mining.
 *
 * Uses runtime-agnostic spawn utilities that work with both Bun and Node.js.
 * Tries a fallback command chain so the plugin still works across different install methods:
 *   1. `mempalace ...`                (pip --user + ~/.local/bin on PATH)
 *   2. `python3 -m mempalace ...`     (pip install, python3 on PATH)
 *   3. `python -m mempalace ...`      (Windows, or systems with only `python`)
 *
 * All operations are best-effort: failures are silent, no exceptions
 * propagate into plugin hooks. If mempalace is not installed, the plugin
 * simply skips mining and continues normal operation.
 */

import path from "node:path";
import {
  runCommand,
  runCommandSync,
  runCommandWithOutput,
} from "./spawn.js";

const CLI_TIMEOUT_MS = 5000;

type FallbackCommand = { cmd: string; args: string[] };

function buildMineCommands(
  dir: string,
  mode: string,
  wing: string,
): FallbackCommand[] {
  const mineArgs = ["mine", dir, "--mode", mode, "--wing", wing];
  return [
    { cmd: "mempalace", args: mineArgs },
    { cmd: "python3", args: ["-m", "mempalace", ...mineArgs] },
    { cmd: "python", args: ["-m", "mempalace", ...mineArgs] },
  ];
}

/**
 * Asynchronously mine a workspace directory into the palace.
 *
 * Tries fallback commands in order, returning as soon as one succeeds.
 * Returns silently regardless of outcome — callers should not await
 * a specific result, only completion.
 */
export async function mine(
  dir: string,
  mode: string,
  wing: string,
): Promise<void> {
  for (const { cmd, args } of buildMineCommands(dir, mode, wing)) {
    if (await runCommand(cmd, args, CLI_TIMEOUT_MS)) return;
  }
}

/**
 * Synchronously mine a workspace directory. Used by process exit handlers
 * where async would be too late (process may terminate before the event
 * loop drains). Blocks the event loop for up to `CLI_TIMEOUT_MS * 3` in
 * the worst case (all three fallbacks time out).
 */
export function mineSync(dir: string, mode: string, wing: string): void {
  for (const { cmd, args } of buildMineCommands(dir, mode, wing)) {
    if (runCommandSync(cmd, args, CLI_TIMEOUT_MS)) return;
  }
}

/**
 * Check if mempalace is initialized for a workspace.
 * Checks if palace directory exists at workspace/.mempalace/palace
 */
export async function isInitialized(dir: string): Promise<boolean> {
  const palacePath = path.join(dir, ".mempalace", "palace");
  const args = ["status", "--palace", palacePath];

  for (const cmd of ["mempalace", "python3", "python"]) {
    const fullArgs = cmd === "mempalace" ? args : ["-m", "mempalace", ...args];
    const result = await runCommandWithOutput(cmd, fullArgs, CLI_TIMEOUT_MS);
    if (result !== null) return true;
  }
  return false;
}

/**
 * Initialize mempalace for a workspace.
 * Runs 'mempalace init --yes dir' in background.
 */
export async function initialize(dir: string): Promise<void> {
  const initArgs = ["init", "--yes", dir];

  for (const cmd of ["mempalace", "python3", "python"]) {
    const args = cmd === "mempalace" ? initArgs : ["-m", "mempalace", ...initArgs];
    if (await runCommand(cmd, args, CLI_TIMEOUT_MS)) return;
  }
}

/**
 * Wake up mempalace and get L0+L1 memory for a wing.
 * Returns AAAK-compressed memory context or null on failure.
 */
export async function wakeUp(wing: string): Promise<string | null> {
  const args = ["wake-up", "--wing", wing];

  for (const cmd of ["mempalace", "python3", "python"]) {
    const fullArgs = cmd === "mempalace" ? args : ["-m", "mempalace", ...args];
    const result = await runCommandWithOutput(cmd, fullArgs, CLI_TIMEOUT_MS);
    if (result !== null && result.length > 0) return result;
  }
  return null;
}
