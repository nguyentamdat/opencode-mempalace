import type { PluginInput, PluginOptions } from "@opencode-ai/plugin";
import type { StateManager } from "../shared/state.js";
import { PALACE_PROTOCOL, MAX_MEMORY_LENGTH, STATUS_MESSAGES } from "../shared/protocol.js";
import { log, logWarn } from "../shared/logger.js";
import { wakeUp } from "../mempalace-cli.js";

export interface HooksContext {
  sessionsSeen: Set<string>;
  diaryWritten: Set<string>;
  wing: string;
  workspaceDir: string;
  stateManager: StateManager;
  disableAutoLoad: boolean;
  autoMiningEnabled: boolean;
  ensureInitialized: () => Promise<"ready" | "initializing" | "empty">;
}

export interface CreatedHooks {
  systemTransform: (input: { sessionID?: string; model: unknown }, output: { system: string[] }) => Promise<void>;
  chatMessage: (input: { sessionID: string; messageID?: string }, output: { parts: Array<{ type: string; text?: string; [key: string]: unknown }> }) => Promise<void>;
  toolExecuteAfter: (input: { tool: string; sessionID: string; callID: string; args: unknown }) => Promise<void>;
  sessionCompacting: (input: { sessionID: string }, output: { context: string[]; prompt?: string }) => Promise<void>;
  event: (params: { event: unknown }) => Promise<void>;
}

export function createHooks(context: HooksContext): CreatedHooks {
  const { sessionsSeen, diaryWritten, wing, workspaceDir, stateManager, disableAutoLoad, autoMiningEnabled, ensureInitialized } = context;

  return {
    // System prompt transformation
    async systemTransform(_input, output) {
      output.system.push(PALACE_PROTOCOL);
    },

    // First message wakeUp injection
    async chatMessage(input, output) {
      // Only inject wakeUp on first message of session
      if (!disableAutoLoad && !sessionsSeen.has(input.sessionID)) {
        sessionsSeen.add(input.sessionID);

        const state = await ensureInitialized();
        let memoryText = "";

        if (state === "empty") {
          memoryText = STATUS_MESSAGES.empty;
        } else if (state === "initializing") {
          memoryText = STATUS_MESSAGES.initializing;
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
          const { mine } = await import("../mempalace-cli.js");
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

    // Track diary writes
    async toolExecuteAfter(input) {
      if (input.tool === "mcp_mempalace_mempalace_diary_write") {
        diaryWritten.add(input.sessionID);
      }
    },

    // Pre-compaction reminder
    async sessionCompacting(input, output) {
      // Check diary first
      if (!diaryWritten.has(input.sessionID)) {
        output.context.push(STATUS_MESSAGES.diaryReminder);
      }

      // Then inject memory context
      const state = await ensureInitialized();

      if (state === "empty") {
        output.context.push(STATUS_MESSAGES.empty);
        return;
      }

      if (state === "initializing") {
        output.context.push(STATUS_MESSAGES.initializing);
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

    // Event-driven auto-mining
    async event(params) {
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
        (ev.type === "session.status" && ev.properties?.status?.type === "idle");
        
      if (!isIdleEvent) return;
      
      const sessionID = ev.properties?.sessionID ?? ev.properties?.info?.id;
      if (!sessionID || !stateManager.hasPendingMessages(sessionID)) return;
      if (!stateManager.acquireMiningLock(sessionID)) return;

      const { mine } = await import("../mempalace-cli.js");
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
  };
}
