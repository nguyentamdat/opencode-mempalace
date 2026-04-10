import type { StateManager } from "../shared/state.js";
import { logWarn } from "../shared/logger.js";
import { mineSync } from "../mempalace-cli.js";

export interface DisposeContext {
  autoMiningEnabled: boolean;
  stateManager: StateManager;
  workspaceDir: string;
  wing: string;
}

export interface DisposeFns {
  flushDirtySessions: () => void;
  dispose: () => void;
}

export function createPluginDispose(context: DisposeContext): DisposeFns {
  const { autoMiningEnabled, stateManager, workspaceDir, wing } = context;
  
  let isFlushing = false;
  let disposed = false;

  const flushDirtySessions = (): void => {
    if (!autoMiningEnabled || isFlushing || disposed) return;
    isFlushing = true;
    const dirty = stateManager.getDirtySessions();
    if (dirty.length > 0) {
      mineSync(workspaceDir, "convos", wing);
      for (const id of dirty) {
        stateManager.resetCount(id);
      }
    }
    isFlushing = false;
  };

  const dispose = (): void => {
    if (disposed) return;
    disposed = true;
    
    // Final flush
    flushDirtySessions();
    
    logWarn("Plugin disposed - cleanup complete");
  };

  // Register exit handlers
  if (autoMiningEnabled) {
    process.on("exit", flushDirtySessions);
    process.on("SIGINT", () => {
      flushDirtySessions();
      process.exit(130);
    });
    process.on("SIGTERM", () => {
      flushDirtySessions();
      process.exit(143);
    });
  }

  return { flushDirtySessions, dispose };
}
