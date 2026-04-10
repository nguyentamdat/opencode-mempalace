import path from "node:path";
import { createRequire } from "node:module";

import { tool, type Plugin, type PluginInput, type PluginOptions } from "@opencode-ai/plugin";

import { checkAndUpdate, type UpdateResult } from "./auto-update.js";
import { StateManager } from "./shared/state.js";
import { mine, mineSync, wakeUp, isInitialized, initialize } from "./mempalace-cli.js";
import { getWingFromPath, isEmptyWorkspace } from "./shared/utils.js";
import { log, logWarn, logError, flushSync } from "./shared/logger.js";
import { runCommand } from "./spawn.js";
import { parsePluginOptions, type MempalacePluginOptions, DEFAULT_MCP_COMMAND } from "./config/index.js";
import { createHooks } from "./hooks/index.js";
import { createPluginDispose } from "./features/plugin-dispose.js";
import { createUpdateNotification } from "./features/update-notification.js";
import { PALACE_PROTOCOL, MAX_MEMORY_LENGTH, STATUS_MESSAGES } from "./shared/protocol.js";

const require = createRequire(import.meta.url);
const PLUGIN_VERSION: string = require("../package.json").version;

/**
 * MemPalace Plugin - Refactored using OMO factory patterns
 * 
 * Architecture:
 * - Config validation via Zod (src/config/)
 * - Hooks composition via factory (src/hooks/)
 * - Feature-specific modules (src/features/)
 * - Shared utilities (src/shared/)
 * - Error classification (src/shared/error-classifier.ts)
 */
const mempalacePlugin: Plugin = async (input: PluginInput, options?: PluginOptions) => {
  // Parse and validate options using Zod
  const opts = parsePluginOptions(options ?? {});
  
  log("Plugin loading", { version: PLUGIN_VERSION, directory: input.directory });
  flushSync();

  const mcpCommand = opts.mcpCommand ?? DEFAULT_MCP_COMMAND;
  const sessionsSeen = new Set<string>();
  const diaryWritten = new Set<string>();

  // --- Workspace setup with security validation ---
  const workspaceDirRaw = input.worktree || input.directory || process.cwd();
  
  let workspaceDir = path.resolve(workspaceDirRaw);
  if (!workspaceDir || workspaceDir.includes("\0") || workspaceDir.length > 4096) {
    logWarn("Invalid workspace path, using current directory");
    workspaceDir = process.cwd();
  }
  
  let wing = getWingFromPath(workspaceDir);
  if (wing.length > 100) {
    logWarn("Wing name too long, truncating");
    wing = wing.substring(0, 100);
  }

  const miningThreshold = opts.threshold;
  const autoMiningEnabled = !opts.disableAutoMining;
  const stateManager = new StateManager(miningThreshold);

  // --- 3-state initialization: empty, initializing, ready ---
  let initializationDone = false;
  let isInitializing = false;

  const ensureInitialized = async (): Promise<"ready" | "initializing" | "empty"> => {
    if (isEmptyWorkspace(workspaceDir)) {
      return "empty";
    }

    if (initializationDone) {
      return "ready";
    }

    if (isInitializing) {
      return "initializing";
    }

    const initialized = await isInitialized(workspaceDir);
    if (initialized) {
      initializationDone = true;
      return "ready";
    }

    // Start background initialization
    isInitializing = true;
    initialize(workspaceDir)
      .then(() => {
        initializationDone = true;
      })
      .catch((e) => {
        logError("Background initialization failed:", e);
      })
      .finally(() => {
        isInitializing = false;
      });

    return "initializing";
  };

  // --- Create plugin dispose handlers ---
  const { flushDirtySessions } = createPluginDispose({
    autoMiningEnabled,
    stateManager,
    workspaceDir,
    wing,
  });

  // --- Auto-update check (fire-and-forget) ---
  let updateResult: UpdateResult | null = null;
  if (!opts.disableAutoUpdate) {
    checkAndUpdate(
      async () => {
        try {
          return await runCommand("bun", ["install"], 30000);
        } catch {
          return false;
        }
      },
      true,
    )
      .then((result) => {
        updateResult = result;
        if (result.updated) {
          log(`Auto-updated: ${result.currentVersion} → ${result.latestVersion}. Restart to apply.`);
        }
      })
      .catch(() => {});
  }

  // --- Create hooks using factory pattern ---
  const hooks = createHooks({
    sessionsSeen,
    diaryWritten,
    wing,
    workspaceDir,
    stateManager,
    disableAutoLoad: opts.disableAutoLoad,
    autoMiningEnabled,
    ensureInitialized,
  });

  return {
    config: opts.disableMcp
      ? undefined
      : async (config) => {
          if (!config.mcp) config.mcp = {};
          if (!config.mcp.mempalace) {
            config.mcp.mempalace = {
              type: "local" as const,
              command: mcpCommand,
              environment: opts.palacePath ? { MEMPALACE_PALACE_PATH: opts.palacePath } : {},
            };
          }
        },

    "experimental.chat.system.transform": async (_input, output) => {
      if (!opts.disableProtocol) {
        output.system.push(PALACE_PROTOCOL);
      }

      const updateNotification = createUpdateNotification({ updateResult, PLUGIN_VERSION });
      if (updateNotification) {
        output.system.push(updateNotification);
      }
    },

    "chat.message": hooks.chatMessage,

    "tool.execute.after": hooks.toolExecuteAfter,

    "experimental.session.compacting": hooks.sessionCompacting,

    event: !autoMiningEnabled ? undefined : hooks.event,

    tool: {
      mempalace_check_diary: tool({
        description:
          "Check if a mempalace diary entry has been written for the current session. Call before ending work to ensure session learnings are persisted.",
        args: {},
        execute: async (_args, context) => {
          if (diaryWritten.has(context.sessionID)) {
            return "✅ Diary entry already written for this session.";
          }
          return "⚠️ No diary entry written yet for this session. Call mcp_mempalace_mempalace_diary_write to save session learnings before they are lost.";
        },
      }),
    },
  };
};

export default mempalacePlugin;
export { mempalacePlugin as server };
