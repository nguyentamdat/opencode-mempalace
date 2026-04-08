import { tool, type Plugin, type PluginInput, type PluginOptions } from "@opencode-ai/plugin";
import { checkAndUpdate, type UpdateResult } from "./auto-update.js";

interface MempalacePluginOptions extends Record<string, unknown> {
  /** Command array to start the mempalace MCP server. Defaults to ["bun", "run", "<auto-detected path>"] */
  mcpCommand?: string[];
  /** Disable auto-registering mempalace MCP server (if you configure it manually in opencode.jsonc) */
  disableMcp?: boolean;
  /** Disable injecting PALACE_PROTOCOL into system prompt */
  disableProtocol?: boolean;
  /** Disable auto-loading mempalace context on first message of each session */
  disableAutoLoad?: boolean;
  /** Disable auto-update check on session start */
  disableAutoUpdate?: boolean;
  /** ChromaDB server URL. Defaults to http://localhost:8000 */
  chromaUrl?: string;
}

const DEFAULT_MCP_COMMAND = [
  "bun",
  "run",
  "/home/dat/mempalace-js/src/mcp-server.ts",
];

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

Call both in parallel. If either fails (ChromaDB not running), skip silently and continue.
Use the results to inform your responses — do not announce or summarize them unless the user asks.
Proceed with the user's request immediately.`;

const mempalacePlugin: Plugin = async (input: PluginInput, options?: PluginOptions) => {
  const opts = (options ?? {}) as MempalacePluginOptions;
  const mcpCommand = opts.mcpCommand ?? DEFAULT_MCP_COMMAND;
  const sessionsSeen = new Set<string>();
  const diaryWritten = new Set<string>();

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
              environment: { CHROMA_URL: opts.chromaUrl ?? "http://localhost:8001" },
            };
          }
        },

    "experimental.chat.system.transform": async (
      _input: { sessionID?: string; model: unknown },
      output: { system: string[] },
    ) => {
      if (!opts.disableProtocol) {
        output.system.push(PALACE_PROTOCOL);
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

    // --- Hook 5: Auto-load on first message ---
    "chat.message": opts.disableAutoLoad
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
          if (sessionsSeen.has(input.sessionID)) return;
          sessionsSeen.add(input.sessionID);

          const firstTextPart = output.parts.find((p) => p.type === "text");
          if (firstTextPart && "text" in firstTextPart) {
            firstTextPart.text = `${SESSION_START_INSTRUCTION}\n\n${firstTextPart.text}`;
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
