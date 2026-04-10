/**
 * MemPalace Protocol String
 * 
 * Following OMO pattern: Extract large string constants to dedicated files
 * for better organization and maintainability.
 */

export const PALACE_PROTOCOL = `IMPORTANT — MemPalace Memory Protocol (Project-First):

1. MEMORIES ARE PROJECT-SCOPED: Each workspace maps to a mempalace "wing". Always specify wing parameter when searching/querying to get project-relevant context.

2. ON WAKE-UP: Call mcp_mempalace_mempalace_status + mcp_mempalace_mempalace_list_rooms(wing=current_project) + mcp_mempalace_mempalace_search(wing=current_project) to load project context.

3. BEFORE RESPONDING about project specifics: call mcp_mempalace_mempalace_search with wing=current_project FIRST. Never guess — verify against project memory.

4. IF UNSURE about any fact: say "let me check" and query the palace with appropriate wing filter.

5. AFTER EACH SESSION: call mcp_mempalace_mempalace_diary_write (agent diary) + consider filing important learnings to the current project's wing via mcp_mempalace_mempalace_add_drawer.

6. WHEN FACTS CHANGE: mcp_mempalace_mempalace_kg_invalidate old facts, mcp_mempalace_mempalace_kg_add new ones.

Project context > Agent diary. Storage + project-scoped protocol = memory.`;

export const MAX_MEMORY_LENGTH = 4000;

// Status messages
export const STATUS_MESSAGES = {
  empty: "[MemPalace]: This environment has no memory yet. Please proceed with standard logic.",
  initializing: "[MemPalace]: The memory system is being built asynchronously in the background. The current response will not include historical memory context.",
  diaryReminder: "⚠️ MEMPALACE: No diary entry written yet for this session. Call mcp_mempalace_mempalace_diary_write with a session summary BEFORE important context is lost to compaction.",
} as const;
