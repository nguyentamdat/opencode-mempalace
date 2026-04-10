import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import plugin from "./index.js";
import type { PluginInput, PluginOptions } from "@opencode-ai/plugin";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

describe("Plugin Integration", () => {
  let testDir: string;
  let mockInput: PluginInput;

  beforeEach(() => {
    testDir = path.join(os.tmpdir(), "mempalace-plugin-test-" + Date.now());
    fs.mkdirSync(testDir, { recursive: true });
    
    mockInput = {
      directory: testDir,
      worktree: testDir,
    };
  });

  afterEach(() => {
    try {
      fs.rmSync(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe("Plugin exports", () => {
    it("should export plugin as default", () => {
      expect(plugin).toBeDefined();
    });

    it("should be a function", () => {
      expect(typeof plugin).toBe("function");
    });

    it("should accept PluginInput and return object", async () => {
      const result = await plugin(mockInput, {});
      expect(result).toBeDefined();
      expect(typeof result).toBe("object");
    });
  });

  describe("Plugin configuration", () => {
    it("should handle empty options", async () => {
      const result = await plugin(mockInput, {});
      expect(result).toBeDefined();
    });

    it("should handle MCP disabled", async () => {
      const result = await plugin(mockInput, { disableMcp: true });
      expect(result).toBeDefined();
    });

    it("should handle protocol disabled", async () => {
      const result = await plugin(mockInput, { disableProtocol: true });
      expect(result).toBeDefined();
    });

    it("should handle auto-load disabled", async () => {
      const result = await plugin(mockInput, { disableAutoLoad: true });
      expect(result).toBeDefined();
    });

    it("should handle auto-update disabled", async () => {
      const result = await plugin(mockInput, { disableAutoUpdate: true });
      expect(result).toBeDefined();
    });

    it("should handle auto-mining disabled", async () => {
      const result = await plugin(mockInput, { disableAutoMining: true });
      expect(result).toBeDefined();
    });

    it("should handle custom threshold", async () => {
      const result = await plugin(mockInput, { threshold: 20 });
      expect(result).toBeDefined();
    });

    it("should handle custom palacePath", async () => {
      const result = await plugin(mockInput, { palacePath: "/custom/path" });
      expect(result).toBeDefined();
    });

    it("should handle custom mcpCommand", async () => {
      const result = await plugin(mockInput, { mcpCommand: ["python", "-m", "mempalace.mcp_server"] });
      expect(result).toBeDefined();
    });

    it("should handle all options disabled", async () => {
      const result = await plugin(mockInput, {
        disableMcp: true,
        disableProtocol: true,
        disableAutoLoad: true,
        disableAutoUpdate: true,
        disableAutoMining: true,
      });
      expect(result).toBeDefined();
    });
  });

  describe("Plugin hooks", () => {
    it("should have config hook when MCP enabled", async () => {
      const result = await plugin(mockInput, { disableMcp: false });
      expect(result.config).toBeDefined();
    });

    it("should not have config hook when MCP disabled", async () => {
      const result = await plugin(mockInput, { disableMcp: true });
      expect(result.config).toBeUndefined();
    });

    it("should have system transform hook", async () => {
      const result = await plugin(mockInput, {});
      expect(result["experimental.chat.system.transform"]).toBeDefined();
    });

    it("should have chat message hook", async () => {
      const result = await plugin(mockInput, {});
      expect(result["chat.message"]).toBeDefined();
    });

    it("should have tool execute after hook", async () => {
      const result = await plugin(mockInput, {});
      expect(result["tool.execute.after"]).toBeDefined();
    });

    it("should have session compacting hook", async () => {
      const result = await plugin(mockInput, {});
      expect(result["experimental.session.compacting"]).toBeDefined();
    });

    it("should have event hook when auto-mining enabled", async () => {
      const result = await plugin(mockInput, { disableAutoMining: false });
      expect(result.event).toBeDefined();
    });

    it("should not have event hook when auto-mining disabled", async () => {
      const result = await plugin(mockInput, { disableAutoMining: true });
      expect(result.event).toBeUndefined();
    });

    it("should have custom tool", async () => {
      const result = await plugin(mockInput, {});
      expect(result.tool).toBeDefined();
      expect(result.tool?.mempalace_check_diary).toBeDefined();
    });
  });

  describe("Hook execution", () => {
    it("should handle system transform hook", async () => {
      const result = await plugin(mockInput, {});
      const systemHook = result["experimental.chat.system.transform"];
      const output: { system: string[] } = { system: [] };
      
      await systemHook?.({ model: {} }, output);
      expect(output.system.length).toBeGreaterThan(0);
    });

    it("should handle chat message hook", async () => {
      const result = await plugin(mockInput, { disableAutoLoad: true });
      const chatHook = result["chat.message"];
      const output: { parts: Array<{ type: string; text?: string }> } = { 
        parts: [{ type: "text", text: "Hello" }] 
      };
      
      await chatHook?.(
        { sessionID: "test-session-1", messageID: "msg-1" },
        output
      );
      expect(output.parts).toBeDefined();
    });

    it("should handle tool execute after hook", async () => {
      const result = await plugin(mockInput, {});
      const toolHook = result["tool.execute.after"];
      const output = { title: "", output: "", metadata: {} };
      
      await toolHook?.(
        { tool: "mcp_mempalace_mempalace_diary_write", sessionID: "test", callID: "1", args: {} },
        output
      );
      expect(true).toBe(true);
    });

    it("should handle session compacting hook", async () => {
      const result = await plugin(mockInput, {});
      const compactingHook = result["experimental.session.compacting"];
      const output: { context: string[]; prompt?: string } = { context: [] };
      
      await compactingHook?.({ sessionID: "test-session" }, output);
      expect(output.context).toBeDefined();
    });

    it("should handle event hook", async () => {
      const result = await plugin(mockInput, { disableAutoMining: false });
      const eventHook = result.event;
      
      await eventHook?.({ 
        event: { type: "session.idle", properties: { sessionID: "test", info: { id: "test" } } } 
      });
      expect(true).toBe(true);
    });

    it("should handle custom tool execution", async () => {
      const result = await plugin(mockInput, {});
      const customTool = result.tool?.mempalace_check_diary;
      
      const toolResult = await customTool?.execute?.({}, { sessionID: "test-session" });
      expect(typeof toolResult).toBe("string");
    });

    it("should return diary written message when diary was written", async () => {
      const result = await plugin(mockInput, {});
      const customTool = result.tool?.mempalace_check_diary;
      
      // First write a diary entry via the tool.execute.after hook
      const toolHook = result["tool.execute.after"];
      await toolHook?.(
        { tool: "mcp_mempalace_mempalace_diary_write", sessionID: "test-session", callID: "1", args: {} },
        { title: "", output: "", metadata: {} }
      );
      
      // Then check the diary
      const toolResult = await customTool?.execute?.({}, { sessionID: "test-session" });
      expect(toolResult).toContain("already written");
    });
  });

  describe("Config hook execution", () => {
    it("should add MCP config when not present", async () => {
      const result = await plugin(mockInput, {});
      const configHook = result.config;
      const config: { mcp?: Record<string, unknown> } = {};
      
      await configHook?.(config);
      expect(config.mcp).toBeDefined();
      expect(config.mcp?.mempalace).toBeDefined();
    });

    it("should not override existing mempalace MCP config", async () => {
      const result = await plugin(mockInput, {});
      const configHook = result.config;
      const existingConfig = { type: "stdio", command: ["custom"] };
      const config: { mcp?: { mempalace?: unknown } } = { 
        mcp: { mempalace: existingConfig } 
      };
      
      await configHook?.(config);
      expect(config.mcp?.mempalace).toBe(existingConfig);
    });

    it("should set environment when palacePath provided", async () => {
      const result = await plugin(mockInput, { palacePath: "/custom/palace" });
      const configHook = result.config;
      const config: { mcp?: { mempalace?: { environment?: Record<string, string> } } } = {};
      
      await configHook?.(config);
      expect(config.mcp?.mempalace?.environment?.MEMPALACE_PALACE_PATH).toBe("/custom/palace");
    });
  });

  describe("Edge cases", () => {
    it("should handle empty worktree", async () => {
      const result = await plugin({ directory: testDir }, {});
      expect(result).toBeDefined();
    });

    it("should handle null messageID in chat hook", async () => {
      const result = await plugin(mockInput, { disableAutoLoad: true });
      const chatHook = result["chat.message"];
      const output: { parts: Array<{ type: string; text?: string }> } = { 
        parts: [{ type: "text", text: "Hello" }] 
      };
      
      await chatHook?.(
        { sessionID: "test-session" },
        output
      );
      expect(output.parts).toBeDefined();
    });

    it("should handle event with no sessionID", async () => {
      const result = await plugin(mockInput, { disableAutoMining: false });
      const eventHook = result.event;
      
      await eventHook?.({ 
        event: { type: "session.idle", properties: {} } 
      });
      expect(true).toBe(true);
    });
  });
});
