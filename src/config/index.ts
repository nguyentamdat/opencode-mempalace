import { z } from "zod";

/**
 * MemPalace Plugin Configuration Schemas
 * 
 * Runtime validation using Zod following OMO patterns.
 * Provides type-safe configuration with graceful partial loading.
 */

// Base schema for the MCP command array
const McpCommandSchema = z.array(z.string()).default(["python3", "-m", "mempalace.mcp_server"]);

// Main plugin options schema
export const MempalacePluginOptionsSchema = z.object({
  /** Command array to start the mempalace MCP server */
  mcpCommand: McpCommandSchema,
  
  /** Disable auto-registering mempalace MCP server */
  disableMcp: z.boolean().default(false),
  
  /** Disable injecting PALACE_PROTOCOL into system prompt */
  disableProtocol: z.boolean().default(false),
  
  /** Disable auto-loading mempalace context on first message of each session */
  disableAutoLoad: z.boolean().default(false),
  
  /** Disable auto-update check on session start */
  disableAutoUpdate: z.boolean().default(false),
  
  /** Override the mempalace palace directory */
  palacePath: z.string().optional(),
  
  /** Disable auto-mining on session idle / message threshold / shutdown */
  disableAutoMining: z.boolean().default(false),
  
  /** Number of chat messages per session before auto-mining is triggered */
  threshold: z.number().int().positive().default(15),
});

// Type inference from schema
export type MempalacePluginOptions = z.infer<typeof MempalacePluginOptionsSchema>;

/**
 * Parse and validate plugin options with Zod
 * Returns validated config or falls back to defaults on error
 */
export function parsePluginOptions(options: Record<string, unknown> = {}): MempalacePluginOptions {
  const result = MempalacePluginOptionsSchema.safeParse(options);
  
  if (result.success) {
    return result.data;
  }
  
  // Log validation errors and return defaults
  console.warn("[opencode-mempalace] Invalid plugin options, using defaults:", 
    result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join(', '));
  
  return MempalacePluginOptionsSchema.parse({});
}

/**
 * Partial config parsing - allows partial configuration
 * Useful for validating user overrides without requiring all fields
 */
export function parsePartialOptions(options: Record<string, unknown> = {}): Partial<MempalacePluginOptions> {
  const result = MempalacePluginOptionsSchema.partial().safeParse(options);
  
  if (result.success) {
    return result.data;
  }
  
  console.warn("[opencode-mempalace] Invalid partial options:", 
    result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join(', '));
  
  return {};
}

// Default configuration export
export const DEFAULT_MCP_COMMAND = ["python3", "-m", "mempalace.mcp_server"] as const;
