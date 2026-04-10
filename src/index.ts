import { tool, type Plugin, type PluginInput, type PluginOptions } from "@opencode-ai/plugin";
import { checkAndUpdate, type UpdateResult } from "./auto-update.js";
import { StateManager } from "./state.js";
import { mine, mineSync } from "./mempalace-cli.js";
import { getWingFromPath } from "./utils.js";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const PLUGIN_VERSION: string = require("../package.json").version;

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

const PALACE_PROTOCOL = `IMPORTANT — MemPalace Memory Protocol:
1. ON WAKE-UP: Call mempalace_status to load palace overview + AAAK spec.
2. BEFORE RESPONDING about any person, project, or past event: call mempalace_kg_query or mempalace_search FIRST. Never guess — verify.
3. IF UNSURE about a fact (name, gender, age, relationship): say "let me check" and query the palace. Wrong is worse than slow.
4. AFTER EACH SESSION: call mempalace_diary_write to record what happened, what you learned, what matters.
5. WHEN FACTS CHANGE: call mempalace_kg_invalidate on the old fact, mempalace_kg_add for the new one.

This protocol ensures the AI KNOWS before it speaks. Storage is not memory — but storage + this protocol = memory.`;

const SESSION_START_INSTRUCTION = `[SYSTEM — MemPalace Context Load]
On session start, load mempalace context by calling these tools directly (do NOT delegate to a subagent):

1. mcp_mempalace_mempalace_diary_read(agent_name="sisyphus", last_n=3) — recent diary entries
2. mcp_mempalace_mempalace_status() — palace overview (wings, rooms, drawer count)

Call both in parallel. If either fails (mempalace not installed), skip silently and continue.
Use the results to inform your responses — do not announce or summarize them unless the user asks.
Proceed with the user's request immediately.
<!-- MEMPALACE -->`;

const mempalacePlugin: Plugin = async (input: PluginInput, options?: PluginOptions) => {
  const opts = (options ?? {}) as MempalacePluginOptions;
  const mcpCommand = opts.mcpCommand ?? DEFAULT_MCP_COMMAND;
  const sessionsSeen = new Set<string>();
  const diaryWritten = new Set<string>();

  // --- Auto-mining setup (ported from option-K/opencode-plugin-mempalace) ---
  const workspaceDir = input.worktree || input.directory || process.cwd();
  const wing = getWingFromPath(workspaceDir);
  const miningThreshold =
    typeof opts.threshold === "number" && opts.threshold > 0
      ? opts.threshold
      : 15;
  const autoMiningEnabled = !opts.disableAutoMining;
  const stateManager = new StateManager(miningThreshold);

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
            `[opencode-mempalace] Auto-updated: ${result.currentVersion} \u2192 ${result.latestVersion}. Restart to apply.`,
          );
        } else if (result.error) {
          console.log(
            `[opencode-mempalace] Update available: ${result.currentVersion} \u2192 ${result.latestVersion} (install failed: ${result.error})`,
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
      if (!opts.disableProtocol) {
        output.system.push(PALACE_PROTOCOL);
        // Show toast notification at session start
        input.client?.tui?.showToast({
          body: {
            title: `MemPalace ${PLUGIN_VERSION}`,
            message: "Memory system active — auto-mining enabled",
            variant: "info" as const,
            duration: 5000,
          },
        }).catch(() => {});
      }
      if (updateResult?.updated) {
        output.system.push(
          `[opencode-mempalace] Updated ${updateResult.currentVersion} \u2192 ${updateResult.latestVersion}. Restart OpenCode to apply.`,
        );
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
      if (!diaryWritten.has(input.sessionID)) {
        output.context.push(
          "⚠️ MEMPALACE: No diary entry written yet for this session. Call mcp_mempalace_mempalace_diary_write with a session summary BEFORE important context is lost to compaction."
        );
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
          setTimeout(() => {
            mine(workspaceDir, "convos", wing)
              .catch(() => {})
              .finally(() => {
                stateManager.releaseMiningLock(sessionID);
                stateManager.resetCount(sessionID);
              });
          }, 2000);
        },

    // --- Hook 5: Auto-load on first message + auto-mining increment ---
    "chat.message": opts.disableAutoLoad && !autoMiningEnabled
      ? undefined
      : async (
          input: { sessionID: string; messageID?: string },
          output: {
            parts: Array<{
              type: string;
              text?: string;
              [key: string]: unknown;
            }>;
          },
        ) => {
          // Auto-load SESSION_START_INSTRUCTION on first message (if enabled).
          if (!opts.disableAutoLoad && !sessionsSeen.has(input.sessionID)) {
            sessionsSeen.add(input.sessionID);
            const firstTextPart = output.parts.find((p) => p.type === "text");
            if (firstTextPart && "text" in firstTextPart) {
              firstTextPart.text = `${SESSION_START_INSTRUCTION}\n\n${firstTextPart.text}`;
            }
          }

          // Auto-mining: increment message counter, trigger mine when threshold reached.
          if (
            autoMiningEnabled &&
            stateManager.incrementAndCheck(input.sessionID)
          ) {
            if (stateManager.acquireMiningLock(input.sessionID)) {
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

    // --- Hook 6: Custom tool ---
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
