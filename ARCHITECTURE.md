# Architecture

## Overview

opencode-mempalace is an OpenCode plugin that integrates the MemPalace memory system. It follows a **factory pattern architecture** inspired by the oh-my-openagent (OMO) project, emphasizing modularity, testability, and separation of concerns.

## Design Philosophy

### Factory Pattern
The plugin is composed of discrete factory functions that create and configure different aspects of the plugin:

```typescript
// Main orchestration in index.ts
const hooks = createHooks(context);
const { flushDirtySessions, dispose } = createPluginDispose(context);
```

Benefits:
- **Testability**: Each factory can be tested in isolation
- **Composability**: Factories can be combined in different ways
- **Clear dependencies**: Each factory declares its dependencies explicitly
- **Lifecycle management**: Clean disposal patterns

### Domain-Driven Organization

```
src/
├── config/          # Configuration schemas and validation (Zod)
├── features/        # Feature-specific modules (dispose, notifications)
├── hooks/           # OpenCode hook implementations
├── shared/          # Domain-specific utilities (no catch-all utils.ts)
```

Following OMO's rule: **No catch-all files**. Each file has a single, clear responsibility.

## Module Breakdown

### 1. Configuration (`src/config/`)

**Purpose**: Runtime validation and type-safe configuration

**Key Files**:
- `index.ts`: Zod schemas, parsing functions, default values

**Patterns**:
- Zod for runtime validation
- `parsePluginOptions()`: Full validation with fallback
- `parsePartialOptions()`: Partial validation for user overrides

```typescript
const opts = parsePluginOptions(options ?? {});
// Returns validated config or defaults on error
```

### 2. Features (`src/features/`)

**Purpose**: Self-contained feature modules

**Key Files**:
- `plugin-dispose.ts`: Cleanup lifecycle management
- `update-notification.ts`: Update notification formatting

**Patterns**:
- Each feature exports a `create*()` factory function
- Features declare their context dependencies
- Idempotent disposal patterns

### 3. Hooks (`src/hooks/`)

**Purpose**: OpenCode hook implementations

**Key Files**:
- `index.ts`: All hook implementations (chat.message, session.compacting, etc.)

**Patterns**:
- Single factory `createHooks(context)` returns all hook handlers
- Context object contains all dependencies
- Lazy imports for heavy operations (mine, wakeUp)

### 4. Shared (`src/shared/`)

**Purpose**: Domain-specific utilities

**Key Files**:
- `state.ts`: StateManager for mining locks and counters
- `logger.ts`: Buffered async logging
- `utils.ts`: Path and workspace utilities
- `protocol.ts`: Protocol strings and constants
- `error-classifier.ts`: Error classification for retry logic

**Patterns**:
- Each utility is domain-specific
- No generic `utils.ts` catch-all
- Testing reset utilities (`_resetForTesting()`)

## Data Flow

### Plugin Initialization

```
1. index.ts receives PluginInput + options
2. parsePluginOptions() validates configuration
3. Setup workspace path with security validation
4. Create StateManager with threshold
5. Define ensureInitialized() for 3-state init
6. Create hooks via createHooks()
7. Return plugin object with hooks
```

### Session Lifecycle

```
[Session Start]
  ↓
chat.message hook (first message)
  ↓
ensureInitialized() → wakeUp() → inject context
  ↓
[state === "ready"] continue normally
[state === "initializing"] notify background init
[state === "empty"] proceed without context
  ↓
Auto-mining: increment counter every message
  ↓
Threshold reached → acquire lock → mine()
  ↓
[Session End / Compaction]
  ↓
session.compacting hook
  ↓
Check diaryWritten → remind if needed
  ↓
Re-inject memory context
  ↓
[event: session.idle/deleted]
  ↓
Mine pending messages
```

## Error Handling Strategy

### Error Classification

The `error-classifier.ts` module provides:

1. **Retryable Error Detection**: `isRetryableSpawnError()`
   - ETIMEDOUT, ECONNREFUSED, EAGAIN
   - Pattern matching for "timeout", "rate limit", etc.

2. **Error Categorization**: `classifyInitError()`
   - "missing_dependency": mempalace not installed
   - "timeout": initialization timeout
   - "unknown": other errors

3. **Safe Async Wrapper**: `safeAsync()`
   - Wraps operations with error classification
   - Returns structured result: `{ success, data?, error?, retryable? }`

### Best Practices

- Fail silently in background operations (mining)
- Log errors without throwing
- Provide graceful degradation
- Never block user workflow on memory operations

## Testing Strategy

### Test Setup

**bunfig.toml**:
```toml
preload = ["./test-setup.ts"]
```

**test-setup.ts**: Centralized beforeEach that resets stateful modules

### Test Organization

- Tests co-located with source files: `feature.ts` + `feature.test.ts`
- `_resetForTesting()` exports for stateful modules
- Factory pattern enables easy mocking

### Test Patterns

```typescript
describe("StateManager", () => {
  beforeEach(() => {
    stateManager = new StateManager();
  });
  
  it("should handle edge case", () => {
    // Test with fresh instance
  });
});
```

## Performance Optimizations

### Current Optimizations

1. **Buffered Logging**: Batches log writes (500ms flush interval)
2. **Mining Locks**: Prevents concurrent mining on same session
3. **Lazy Initialization**: Palace init happens in background
4. **3-State Initialization**: empty → initializing → ready

### Opportunities

1. **wakeUp() Caching**: Cache L0+L1 memory with TTL
2. **Path Validation Caching**: Cache workspace validation results
3. **Event Debouncing**: Debounce rapid session events
4. **Memory Truncation**: Configurable MAX_MEMORY_LENGTH

## Security Considerations

### Path Validation

```typescript
let workspaceDir = path.resolve(workspaceDirRaw);
if (!workspaceDir || workspaceDir.includes("\0") || workspaceDir.length > 4096) {
  logWarn("Invalid workspace path, using current directory");
  workspaceDir = process.cwd();
}
```

### String Length Validation

```typescript
if (wing.length > 100) {
  logWarn("Wing name too long, truncating");
  wing = wing.substring(0, 100);
}
```

### Input Sanitization

- Wing names sanitized: `/[^a-z0-9]/g` → `-`
- Empty workspace detection with ignored files list

## Configuration Reference

### Plugin Options (Zod Schema)

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| mcpCommand | string[] | ["python3", "-m", "mempalace.mcp_server"] | MCP server command |
| disableMcp | boolean | false | Skip MCP registration |
| disableProtocol | boolean | false | Skip PALACE_PROTOCOL injection |
| disableAutoLoad | boolean | false | Skip wakeUp injection |
| disableAutoUpdate | boolean | false | Skip auto-update check |
| palacePath | string | undefined | Override palace directory |
| disableAutoMining | boolean | false | Disable background mining |
| threshold | number | 15 | Messages before auto-mining |

### Environment Variables

- `MEMPALACE_PALACE_PATH`: Override palace directory (set via MCP environment)
- `XDG_CACHE_HOME`: Log file location

## Future Enhancements

### Planned

1. **Schema Caching**: Cache parsed Zod schemas
2. **Incremental Mining**: Mine only changed conversations
3. **Memory Compression**: Better AAAK compression integration
4. **Metrics**: Track mining success/failure rates

### Considered

1. **Plugin Skills**: Add `.opencode/skills/` for domain-specific behaviors
2. **Custom Protocols**: User-defined protocol strings
3. **Multi-Wing Support**: Cross-project memory correlation

## References

- [OMO Project](https://github.com/code-yeongyu/oh-my-openagent): Factory pattern inspiration
- [MemPalace](https://github.com/milla-jovovich/mempalace): Memory system architecture
- [OpenCode Plugin API](https://opencode.ai/docs): Hook system documentation
