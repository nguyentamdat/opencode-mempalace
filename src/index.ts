import { tool, type Plugin, type PluginOptions } from "@opencode-ai/plugin";

interface MempalacePluginOptions extends Record<string, unknown> {
  /** Command array to start the mempalace MCP server. Defaults to ["bun", "run", "<auto-detected path>"] */
  mcpCommand?: string[];
  /** Disable auto-registering mempalace MCP server (if you configure it manually in opencode.jsonc) */
  disableMcp?: boolean;
  /** Disable injecting PALACE_PROTOCOL into system prompt */
  disableProtocol?: boolean;
  /** Disable auto-loading mempalace context on first message of each session */
  disableAutoLoad?: boolean;
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
Spawn a background explore agent to load mempalace context for this session:

task(
  subagent_type="explore",
  run_in_background=true,
  load_skills=["mempalace"],
  description="Load mempalace context",
  prompt="Query mempalace MCP tools to retrieve relevant context for this session.

  Execute these queries IN ORDER, stop early if ChromaDB is not running:

  1. Call mcp_mempalace_mempalace_diary_read(agent_name='sisyphus', last_n=5)
  2. Call mcp_mempalace_mempalace_status()
  3. Call mcp_mempalace_mempalace_kg_query(entity='*')

  Return a concise summary of:
  - Recent diary entries (last 3 days)
  - Palace structure (wings, room count, total memories)
  - Key entities and their latest facts

  If ChromaDB is not running or mempalace tools fail, just return 'Mempalace unavailable - ChromaDB not running.'
  Do NOT retry failed calls. Do NOT try to fix the connection."
)

Continue with the user's request immediately after spawning. Collect results via background_output when the notification arrives.`;

const mempalacePlugin: Plugin = async (_input, options?: PluginOptions) => {
  const opts = (options ?? {}) as MempalacePluginOptions;
  const mcpCommand = opts.mcpCommand ?? DEFAULT_MCP_COMMAND;
  const sessionsSeen = new Set<string>();
  const diaryWritten = new Set<string>();

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

    "experimental.chat.system.transform": opts.disableProtocol
      ? undefined
      : async (
          _input: { sessionID?: string; model: unknown },
          output: { system: string[] },
        ) => {
          output.system.push(PALACE_PROTOCOL);
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
