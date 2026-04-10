/**
 * Enhanced MemPalace CLI with error classification
 * 
 * Following OMO pattern: Wraps operations with error classification
 * for better retry logic and debugging
 */

import path from "node:path";
import {
  runCommand,
  runCommandSync,
  runCommandWithOutput,
} from "./spawn.js";
import { safeAsync, classifyInitError, isRetryableSpawnError } from "./shared/error-classifier.js";
import { logWarn, logError } from "./shared/logger.js";

const CLI_TIMEOUT_MS = 5000;
const MAX_RETRIES = 2;

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
 * Enhanced with error classification and retry logic.
 */
export async function mine(
  dir: string,
  mode: string,
  wing: string,
): Promise<void> {
  const commands = buildMineCommands(dir, mode, wing);
  let lastError: Error | null = null;

  for (const { cmd, args } of commands) {
    const result = await safeAsync(
      () => runCommand(cmd, args, CLI_TIMEOUT_MS),
      `mining with ${cmd}`
    );

    if (result.success && result.data) {
      return; // Success
    }

    if (!result.success) {
      lastError = new Error(result.error.message);
      
      // Log classified error
      if (result.retryable) {
        logWarn(`Retryable mining error with ${cmd}`, { error: result.error.message });
      } else {
        logError(`Non-retryable mining error with ${cmd}`, result.error);
      }
    }
  }

  // All fallbacks failed
  if (lastError) {
    const classification = classifyInitError(lastError);
    logError(`Mining failed after all fallbacks`, { classification, message: lastError.message });
  }
}

/**
 * Synchronously mine a workspace directory.
 * Used by process exit handlers.
 */
export function mineSync(dir: string, mode: string, wing: string): void {
  for (const { cmd, args } of buildMineCommands(dir, mode, wing)) {
    if (runCommandSync(cmd, args, CLI_TIMEOUT_MS)) return;
  }
  // Silent failure in sync context
}

/**
 * Check if mempalace is initialized for a workspace.
 * Enhanced with error classification.
 */
export async function isInitialized(dir: string): Promise<boolean> {
  const palacePath = path.join(dir, ".mempalace", "palace");
  const args = ["status", "--palace", palacePath];

  for (const cmd of ["mempalace", "python3", "python"]) {
    const fullArgs = cmd === "mempalace" ? args : ["-m", "mempalace", ...args];
    
    const result = await safeAsync(
      () => runCommandWithOutput(cmd, fullArgs, CLI_TIMEOUT_MS),
      `checking initialization with ${cmd}`
    );

    if (result.success && result.data !== null) {
      return true;
    }

    // Classify error for better diagnostics
    if (!result.success) {
      const classification = classifyInitError(new Error(result.error.message));
      if (classification === "missing_dependency") {
        logWarn(`MemPalace dependency check failed with ${cmd}`);
      }
    }
  }
  
  return false;
}

/**
 * Initialize mempalace for a workspace.
 * Enhanced with error classification.
 */
export async function initialize(dir: string): Promise<void> {
  const initArgs = ["init", "--yes", dir];

  for (const cmd of ["mempalace", "python3", "python"]) {
    const args = cmd === "mempalace" ? initArgs : ["-m", "mempalace", ...initArgs];
    
    const result = await safeAsync(
      () => runCommand(cmd, args, CLI_TIMEOUT_MS),
      `initializing with ${cmd}`
    );

    if (result.success && result.data) {
      return; // Success
    }

    if (!result.success) {
      const classification = classifyInitError(new Error(result.error.message));
      logWarn(`Initialization attempt failed with ${cmd}`, { classification });
    }
  }
}

// Cache for wakeUp results
let wakeUpCache: Map<string, { result: string; timestamp: number }> = new Map();
const WAKEUP_CACHE_TTL_MS = 30000; // 30 seconds

/**
 * Wake up mempalace and get L0+L1 memory for a wing.
 * Enhanced with caching and error classification.
 */
export async function wakeUp(wing: string): Promise<string | null> {
  // Check cache first
  const cached = wakeUpCache.get(wing);
  if (cached && Date.now() - cached.timestamp < WAKEUP_CACHE_TTL_MS) {
    return cached.result;
  }

  const args = ["wake-up", "--wing", wing];

  for (const cmd of ["mempalace", "python3", "python"]) {
    const fullArgs = cmd === "mempalace" ? args : ["-m", "mempalace", ...args];
    
    const result = await safeAsync(
      () => runCommandWithOutput(cmd, fullArgs, CLI_TIMEOUT_MS),
      `waking up with ${cmd}`
    );

    if (result.success && result.data && result.data.length > 0) {
      // Cache successful result
      wakeUpCache.set(wing, { result: result.data, timestamp: Date.now() });
      return result.data;
    }

    if (!result.success && isRetryableSpawnError(new Error(result.error.message))) {
      logWarn(`Retryable wakeUp error with ${cmd}`, { error: result.error.message });
    }
  }
  
  return null;
}

/**
 * Clear the wakeUp cache (useful for testing)
 */
export function _clearWakeUpCache(): void {
  wakeUpCache.clear();
}

/**
 * Reset for testing
 */
export function _resetForTesting(): void {
  wakeUpCache.clear();
}
