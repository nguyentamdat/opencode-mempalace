# opencode-mempalace Examples

This directory contains example configurations for different use cases.

## Configurations

### Minimal (`config-minimal.jsonc`)
Zero-configuration setup. Just add the plugin and go.

```jsonc
{
  "plugin": ["opencode-mempalace"]
}
```

**Use when**: You want the defaults (15 message threshold, auto-everything enabled).

---

### Advanced (`config-advanced.jsonc`)
Full configuration with all options specified.

```jsonc
{
  "plugin": [
    ["opencode-mempalace", {
      "mcpCommand": ["python3", "-m", "mempalace.mcp_server"],
      "palacePath": "/custom/path/to/palace",
      "threshold": 20
    }]
  ]
}
```

**Use when**: You need custom paths, different thresholds, or specific behavior tuning.

---

### Development (`config-development.jsonc`)
Optimized for plugin development.

```jsonc
{
  "plugin": [
    ["opencode-mempalace", {
      "disableAutoUpdate": true,
      "threshold": 10
    }]
  ]
}
```

**Use when**: Developing the plugin itself - prevents auto-updates and mines more frequently.

---

## Options Reference

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `mcpCommand` | `string[]` | `["python3", "-m", "mempalace.mcp_server"]` | Command to start MCP server |
| `disableMcp` | `boolean` | `false` | Skip MCP registration |
| `disableProtocol` | `boolean` | `false` | Skip PALACE_PROTOCOL injection |
| `disableAutoLoad` | `boolean` | `false` | Skip wakeUp injection |
| `disableAutoUpdate` | `boolean` | `false` | Skip auto-update check |
| `palacePath` | `string` | (default) | Override palace directory |
| `disableAutoMining` | `boolean` | `false` | Disable background mining |
| `threshold` | `number` | `15` | Messages before auto-mining |

## Usage

Copy the desired config to your OpenCode config:

```bash
# For minimal setup
cp examples/config-minimal.jsonc ~/.config/opencode/opencode.jsonc

# For advanced setup  
cp examples/config-advanced.jsonc ~/.config/opencode/opencode.jsonc
```

## See Also

- Main README: `../README.md`
- Architecture: `../ARCHITECTURE.md`
