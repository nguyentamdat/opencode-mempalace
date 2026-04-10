import path from "node:path";

import { tool, type Plugin, type PluginInput, type PluginOptions } from "@opencode-ai/plugin";
import { checkAndUpdate, type UpdateResult } from "./auto-update.js";
import { StateManager } from "./state.js";
import { mine, mineSync, wakeUp, isInitialized, initialize } from "./mempalace-cli.js";
import { getWingFromPath, isEmptyWorkspace } from "./utils.js";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const PLUGIN_VERSION: string = require("../package.json").version;

const MAX_MEMORY_LENGTH = 4000;

interface MempalacePluginOptions extends Record<string, unknown> {
  /** Command array to start the mempalace MCP server. Defaults to ["python3", "-m", "mempalace.mcp_server"] (requires mempalace installed via `pip install mempalace`). */
  mcpCommand?: string[];
  /** Disable auto-registering mempalace MCP server (if you configure it manually in opencode.jsonc) */
  disableMcp?: boolean;
  /** Disable injecting PALACE_PROTOCOL into system prompt */
  disableProtocol?: boolean;
  /** Disable auto-loading mempalace context on first message of each session */
  disableAutoLoad?: boolean;
  /** Disable auto-update check on session start */
  disableAutoUpdate?: boolean;
  /** Override the mempalace palace directory. Maps to MEMPALACE_PALACE_PATH. Defaults to ~/.mempalace/palace (mempalace's own default). */
  palacePath?: string;
  /** Disable auto-mining on session idle / message threshold / shutdown. Defaults to false (auto-mining enabled). */
  disableAutoMining?: boolean;
  /** Number of chat messages per session before auto-mining is triggered. Defaults to 15. */
  threshold?: number;
}

const DEFAULT_MCP_COMMAND = ["python3", "-m", "mempalace.mcp_server"];

const PALACE_PROTOCOL = `IMPORTANT — MemPalace Memory Protocol (Project-First):

1. MEMORIES ARE PROJECT-SCOPED: Each workspace maps to a mempalace "wing". Always specify wing parameter when searching/querying to get project-relevant context.

2. ON WAKE-UP: Call mcp_mempalace_mempalace_status + mcp_mempalace_mempalace_list_rooms(wing=current_project) + mcp_mempalace_mempalace_search(wing=current_project) to load project context.

3. BEFORE RESPONDING about project specifics: call mcp_mempalace_mempalace_search with wing=current_project FIRST. Never guess — verify against project memory.

4. IF UNSURE about any fact: say "let me check" and query the palace with appropriate wing filter.

5. AFTER EACH SESSION: call mcp_mempalace_mempalace_diary_write (agent diary) + consider filing important learnings to the current project's wing via mcp_mempalace_mempalace_add_drawer.

6. WHEN FACTS CHANGE: mcp_mempalace_mempalace_kg_invalidate old facts, mcp_mempalace_mempalace_kg_add new ones.

Project context > Agent diary. Storage + project-scoped protocol = memory.`;

const mempalacePlugin: Plugin = async (input: PluginInput, options?: PluginOptions) => {
  const opts = (options ?? {}) as MempalacePluginOptions;
  const mcpCommand = opts.mcpCommand ?? DEFAULT_MCP_COMMAND;
  const sessionsSeen = new Set<string>();
  const diaryWritten = new Set<string>();

  // --- Auto-mining setup (ported from option-K/opencode-plugin-mempalace) ---
  const workspaceDirRaw = input.worktree || input.directory || process.cwd();
  
  // SECURITY: Validate workspace path to prevent path traversal
  let workspaceDir = path.resolve(workspaceDirRaw);
  if (!workspaceDir || workspaceDir.includes("\0") || workspaceDir.length > 4096) {
    console.warn("[opencode-mempalace] Invalid workspace path, using current directory");
    workspaceDir = process.cwd();
  }
  
  let wing = getWingFromPath(workspaceDir);
  // SECURITY: Validate wing name length
  if (wing.length > 100) {
    console.warn("[opencode-mempalace] Wing name too long, truncating");
    wing = wing.substring(0, 100);
  }
  const miningThreshold =
    typeof opts.threshold === "number" && opts.threshold > 0
      ? opts.threshold
      : 15;
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
        console.warn("[opencode-mempalace] Background initialization failed:", e);
      })
      .finally(() => {
        isInitializing = false;
      });

    return "initializing";
  };

  // --- Exit handlers: flush dirty sessions synchronously on shutdown ---
  let isFlushing = false;
  const flushDirtySessions = (): void => {
    if (!autoMiningEnabled || isFlushing) return;
    isFlushing = true;
    const dirty = stateManager.getDirtySessions();
    if (dirty.length > 0) {
      mineSync(workspaceDir, "convos", wing);
      for (const id of dirty) {
        stateManager.resetCount(id);
      }
    }
  };
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

  // --- Auto-update check (fire-and-forget) ---
  let updateResult: UpdateResult | null = null;
  if (!opts.disableAutoUpdate) {
    checkAndUpdate(async (cwd) => {
      try {
        const result = await input.$`bun install`.cwd(cwd).quiet().nothrow();
        return result.exitCode === 0;
      } catch {
        return false;
      }
    })
      .then((result) => {
        updateResult = result;
        if (result.updated) {
          console.log(
            `[opencode-mempalace] Auto-updated: ${result.currentVersion} → ${result.latestVersion}. Restart to apply.`,
          );
        } else if (result.error) {
          console.log(
            `[opencode-mempalace] Update available: ${result.currentVersion} → ${result.latestVersion} (install failed: ${result.error})`,
          );
        }
      })
      .catch(() => {});
  }

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

    "experimental.chat.system.transform": async (
      _input: { sessionID?: string; model: unknown },
      output: { system: string[] },
    ) => {
      // Always inject PALACE_PROTOCOL
      if (!opts.disableProtocol) {
        output.system.push(PALACE_PROTOCOL);
      }

      // Handle update notification
      if (updateResult?.updated) {
        output.system.push(
          `[opencode-mempalace] Updated ${updateResult.currentVersion} → ${updateResult.latestVersion}. Restart OpenCode to apply.`,
        );
      }
    },

    // --- Hook 2: First message wakeUp injection ---
    "chat.message": async (
      input: { sessionID: string; messageID?: string },
      output: {
        parts: Array<{
          type: string;
          text?: string;
          [key: string]: unknown;
        }>;
      },
    ) => {
      // Only inject wakeUp on first message of session
      if (!opts.disableAutoLoad && !sessionsSeen.has(input.sessionID)) {
        sessionsSeen.add(input.sessionID);

        const state = await ensureInitialized();
        let memoryText = "";

        if (state === "empty") {
          memoryText = "[MemPalace]: This environment has no memory yet. Please proceed with standard logic.";
        } else if (state === "initializing") {
          memoryText = "[MemPalace]: The memory system is being built asynchronously in the background. The current response will not include historical memory context.";
        } else if (state === "ready") {
          const memory = await wakeUp(wing);
          if (memory) {
            memoryText = memory.length > MAX_MEMORY_LENGTH
              ? memory.substring(0, MAX_MEMORY_LENGTH) + "\n...[Memory Truncated]"
              : memory;
          }
        }

        if (memoryText) {
          const firstTextPart = output.parts.find((p) => p.type === "text");
          if (firstTextPart && "text" in firstTextPart) {
            firstTextPart.text = `[SYSTEM — MemPalace Context Load]\n${memoryText}\n\n${firstTextPart.text}`;
          }
        }
      }

      // Auto-mining: increment message counter
      if (autoMiningEnabled && stateManager.incrementAndCheck(input.sessionID)) {
        if (stateManager.acquireMiningLock(input.sessionID)) {
          const state = await ensureInitialized();
          if (state !== "ready") {
            stateManager.releaseMiningLock(input.sessionID);
            return;
          }

          setTimeout(() => {
            mine(workspaceDir, "convos", wing)
              .catch(() => {})
              .finally(() => {
                stateManager.releaseMiningLock(input.sessionID);
              });
          }, 2000);
        }
      }
    },

    // --- Hook 3: Track diary writes ---
    "tool.execute.after": async (
      input: { tool: string; sessionID: string; callID: string; args: unknown },
      _output: { title: string; output: string; metadata: Record<string, unknown> },
    ) => {
      if (input.tool === "mcp_mempalace_mempalace_diary_write") {
        diaryWritten.add(input.sessionID);
      }
    },

    // --- Hook 4: Pre-compaction reminder ---
    "experimental.session.compacting": async (
      input: { sessionID: string },
      output: { context: string[]; prompt?: string },
    ) => {
      // Check diary first
      if (!diaryWritten.has(input.sessionID)) {
        output.context.push(
          "⚠️ MEMPALACE: No diary entry written yet for this session. Call mcp_mempalace_mempalace_diary_write with a session summary BEFORE important context is lost to compaction."
        );
      }

      // Then inject memory context (like original plugin)
      const state = await ensureInitialized();

      if (state === "empty") {
        output.context.push(
          "[MemPalace]: This environment has no memory yet. Please proceed with standard logic.",
        );
        return;
      }

      if (state === "initializing") {
        output.context.push(
          "[MemPalace]: The memory system is being built asynchronously in the background. The current response will not include historical memory context.",
        );
        return;
      }

      // state === "ready" - load memory via wakeUp
      const memory = await wakeUp(wing);
      if (memory) {
        const truncatedMemory =
          memory.length > MAX_MEMORY_LENGTH
            ? memory.substring(0, MAX_MEMORY_LENGTH) + "\n...[Memory Truncated]"
            : memory;
        output.context.push(truncatedMemory);
      }
    },

    // --- Hook 7: Event-driven auto-mining on session idle/deletion ---
    event: !autoMiningEnabled
      ? undefined
      : async (params: { event: unknown }) => {
          const ev = params.event as {
            type?: string;
            properties?: {
              sessionID?: string;
              info?: { id?: string };
              status?: { type?: string };
            };
          };
          const isIdleEvent =
            ev.type === "session.idle" ||
            ev.type === "session.deleted" ||
            (ev.type === "session.status" &&
              ev.properties?.status?.type === "idle");
          if (!isIdleEvent) return;
          const sessionID =
            ev.properties?.sessionID ?? ev.properties?.info?.id;
          if (!sessionID || !stateManager.hasPendingMessages(sessionID)) return;
          if (!stateManager.acquireMiningLock(sessionID)) return;

          const state = await ensureInitialized();
          if (state !== "ready") {
            stateManager.releaseMiningLock(sessionID);
            return;
          }

          setTimeout(() => {
            mine(workspaceDir, "convos", wing)
              .catch(() => {})
              .finally(() => {
                stateManager.releaseMiningLock(sessionID);
                stateManager.resetCount(sessionID);
              });
          }, 2000);
        },

    // --- Hook 5: Custom tool ---
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
