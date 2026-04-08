# opencode-mempalace

OpenCode plugin for the [MemPalace](https://github.com/milla-jovovich/mempalace) memory system — a structured, persistent memory architecture for AI agents.

Auto-registers the MemPalace MCP server, injects the memory protocol into the system prompt, and loads context on session start.

## Install

```bash
# Add to your OpenCode config (~/.config/opencode/opencode.jsonc)
{
  "plugin": ["opencode-mempalace"]
}
```

Requires the mempalace-js MCP server and a running [ChromaDB](https://www.trychroma.com/) instance.

## What it does

1. **MCP auto-registration** — Adds the mempalace MCP server to your OpenCode session automatically (19 tools: search, diary, knowledge graph, entity management, etc.)
2. **Memory protocol injection** — Appends `PALACE_PROTOCOL` to the system prompt, instructing the agent to *verify before guessing* by querying the palace for people, projects, and past events.
3. **Session context loading** — On the first message of each session, spawns a background explore agent to load recent diary entries, palace status, and key entity facts.

## Configuration

Pass options via your OpenCode plugin config:

| Option | Type | Default | Description |
|---|---|---|---|
| `mcpCommand` | `string[]` | Auto-detected | Command to start the MCP server |
| `disableMcp` | `boolean` | `false` | Skip auto-registering MCP server |
| `disableProtocol` | `boolean` | `false` | Skip injecting PALACE_PROTOCOL |
| `disableAutoLoad` | `boolean` | `false` | Skip auto-loading context on first message |

## MCP Tools

The mempalace MCP server exposes 19 tools:

| Tool | Description |
|---|---|
| `mempalace_search` | Semantic memory search |
| `mempalace_kg_query` | Query entity facts from knowledge graph |
| `mempalace_kg_timeline` | Entity fact timeline |
| `mempalace_kg_add` | Add facts to knowledge graph |
| `mempalace_kg_invalidate` | Invalidate outdated facts |
| `mempalace_kg_stats` | Knowledge graph statistics |
| `mempalace_diary_write` | Write diary entry |
| `mempalace_diary_read` | Read recent diary entries |
| `mempalace_status` | Palace overview |
| `mempalace_list_wings` | List palace wings |
| `mempalace_list_rooms` | List rooms in a wing |
| `mempalace_get_taxonomy` | Full wing/room taxonomy |
| `mempalace_add_drawer` | Store a memory |
| `mempalace_delete_drawer` | Remove a memory |
| `mempalace_check_duplicate` | Check for duplicate memories |
| `mempalace_traverse` | Graph traversal (BFS) |
| `mempalace_find_tunnels` | Find cross-wing connections |
| `mempalace_graph_stats` | Graph structure statistics |
| `mempalace_get_aaak_spec` | AAAK compression dialect spec |

## Acknowledgements

This project is a Bun/TypeScript port of the original [mempalace](https://github.com/milla-jovovich/mempalace) by [milla-jovovich](https://github.com/milla-jovovich). The palace architecture, AAAK compression dialect, knowledge graph design, and MCP tool definitions all originate from their work.

## License

MIT
