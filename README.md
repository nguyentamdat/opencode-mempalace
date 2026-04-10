# 🏛️ opencode-mempalace

[![npm version](https://img.shields.io/npm/v/opencode-mempalace.svg)](https://www.npmjs.com/package/opencode-mempalace)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Bun](https://img.shields.io/badge/Built%20with-Bun-black?logo=bun)](https://bun.sh)

> **AI Memory That Actually Works** — Project-scoped, persistent memory for OpenCode with zero-config setup.

OpenCode plugin integrating [MemPalace](https://github.com/milla-jovovich/mempalace) lifetime memory system. Unlike other memory solutions, this provides **true project-scoped memory** with automatic context injection, background mining, and seamless MCP integration.

---

## ✨ Why This Plugin?

| Feature | opencode-mempalace | Other Solutions |
|---------|-------------------|-----------------|
| **Project-scoped memory** | ✅ Automatic per-workspace | ❌ Global only |
| **Auto-initialization** | ✅ Palace auto-created | ❌ Manual setup |
| **Context injection** | ✅ wakeUp() loads L0+L1 memory | ❌ Manual tool calls |
| **Background mining** | ✅ Idle/threshold/exit triggers | ❌ None or manual |
| **MCP Tools** | ✅ 19 native tools | ❌ CLI only |
| **Auto-update** | ✅ Built-in | ❌ Manual |

---

## 🚀 Quick Start

```bash
# 1. Install mempalace CLI globally
pip install mempalace

# 2. Add plugin to OpenCode config
# Edit ~/.config/opencode/opencode.jsonc
{
  "plugin": ["opencode-mempalace"]
}

# 3. Open any project folder in OpenCode
# The plugin auto-initializes and starts tracking memory!
```

---

## 🎯 Key Features

### 1. **Project-Scoped Memory (Wings)**

Each workspace gets its own isolated memory "wing":
```
~/projects/web-app      → wing_web-app
~/projects/api-service  → wing_api-service  
~/projects/mobile-app   → wing_mobile-app
```

Memories never leak between projects. Context is automatically loaded when you switch workspaces.

### 2. **Zero-Config Auto-Initialization**

First time opening a project? The plugin automatically:
- Detects if palace exists
- Initializes it in background if needed
- Loads existing context via `wakeUp()`
- Starts tracking for mining

### 3. **Smart Context Injection**

```
[Session Start] → injects PALACE_PROTOCOL + wakeUp() memory
[Message 2+]    → continues with context aware of previous work  
[Compaction]    → rescues critical memory before context loss
```

### 4. **Background Auto-Mining**

Your conversations are automatically saved:
- **Message threshold**: Every 15 messages (configurable)
- **Session idle**: When you stop chatting
- **Session deleted**: Cleanup trigger
- **Process exit**: Emergency sync save on Ctrl+C

### 5. **19 Native MCP Tools**

Full MemPalace integration without CLI:

| Tool | Description |
|---|---|
| `mempalace_status` | Palace overview |
| `mempalace_search` | Semantic memory search |
| `mempalace_kg_query` | Knowledge graph queries |
| `mempalace_diary_read/write` | Session journaling |
| `mempalace_add_drawer` | Store specific memories |
| ...and 14 more |

### 6. **Built-in Auto-Update**

Checks NPM registry on session start, auto-installs updates in background. Never miss improvements.

---

## 📋 Configuration

```jsonc
// ~/.config/opencode/opencode.jsonc
{
  "plugin": [
    ["opencode-mempalace", {
      "threshold": 20,        // Messages before auto-mining (default: 15)
      "palacePath": "/custom/path",  // Custom palace directory
      "disableAutoLoad": false,       // Skip wakeUp injection
      "disableAutoMining": false,    // Disable background mining
      "disableAutoUpdate": false,     // Disable version checks
      "disableMcp": false            // Skip MCP registration
    }]
  ]
}
```

### Options

| Option | Type | Default | Description |
|---|---|---|---|
| `mcpCommand` | `string[]` | `["python3", "-m", "mempalace.mcp_server"]` | Command to start the MCP server |
| `disableMcp` | `boolean` | `false` | Skip auto-registering MCP server |
| `disableProtocol` | `boolean` | `false` | Skip injecting PALACE_PROTOCOL |
| `disableAutoLoad` | `boolean` | `false` | Skip auto-loading context |
| `disableAutoUpdate` | `boolean` | `false` | Skip auto-update check |
| `palacePath` | `string` | `~/.mempalace/palace` | Override palace directory |
| `disableAutoMining` | `boolean` | `false` | Disable background mining |
| `threshold` | `number` | `15` | Messages before auto-mining |

---

## 🔄 Comparison with option-K/opencode-plugin-mempalace

This plugin is an **evolution** of the excellent [option-K/opencode-plugin-mempalace](https://github.com/option-K/opencode-plugin-mempalace), adding:

| Addition | Benefit |
|----------|---------|
| **MCP Server Integration** | 19 native tools vs CLI-only |
| **Auto-update mechanism** | Self-updating plugin |
| **Diary tracking** | Session journaling with reminders |
| **Bun ecosystem** | Faster builds, no execa dependency |
| **Security hardening** | Path validation, length limits |

**What we kept from the original:**
- ✅ 3-state initialization (empty/initializing/ready)
- ✅ wakeUp() with L0+L1 memory loading
- ✅ Background mining with StateManager
- ✅ Emergency exit handlers
- ✅ Project-scoped wings
- ✅ AAAK compression support

---

## 🧪 Development

```bash
# Clone and setup
git clone https://github.com/nguyentamdat/opencode-mempalace
cd opencode-mempalace
bun install

# Build
bun run build

# Test
bun test

# Check types
bun run check
```

---

## 🙏 Credits & Shout Outs

- **[milla-jovovich/mempalace](https://github.com/milla-jovovich/mempalace)** — The original MemPalace memory system architecture, AAAK dialect, and Python implementation. This plugin is just the OpenCode integration layer.

- **[option-K/opencode-plugin-mempalace](https://github.com/option-K/opencode-plugin-mempalace)** — The pioneering OpenCode plugin that established the patterns for wakeUp, background mining, and 3-state initialization. We ported and extended these concepts.

- **[OpenCode](https://opencode.ai)** — The AI terminal that makes plugins like this possible.

- **[Bun](https://bun.sh)** — The fast JavaScript runtime that powers our builds.

---

## 📄 License

MIT © [nguyentamdat](https://github.com/nguyentamdat)

---

<div align="center">

**⭐ Star this repo if you find it useful!**  
**🐛 Report issues** — **💡 Suggest features** — **🔧 Submit PRs**

</div>
