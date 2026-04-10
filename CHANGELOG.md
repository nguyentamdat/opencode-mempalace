# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.1] - 2025-01-XX

### Added
- **Pinned version respect**: Auto-update now skips if user has pinned a specific version in their config
  - Detects pinned versions like `"opencode-mempalace@0.2.0"` in config
  - Only auto-updates when using unpinned `"opencode-mempalace"` (latest)
  - New `respectPin` parameter in `checkAndUpdate()` function

### Fixed
- **Cache corruption handling**: Plugin now works correctly even when npm cache is corrupted

## [0.2.0] - 2025-01-XX

### Added
- **3-state initialization**: `empty` → `initializing` → `ready` flow
- **wakeUp() integration**: Loads L0+L1 memory context automatically on first message
- **Memory truncation**: Limits memory to 4000 chars with `[Memory Truncated]` indicator
- **isEmptyWorkspace()**: Detects empty projects to skip unnecessary initialization
- **isInitialized()**: Checks if palace exists at workspace/.mempalace/palace
- **initialize()**: Auto-initializes palace in background if not exists
- **Security hardening**:
  - Path validation to prevent traversal attacks
  - Wing name length limits (100 chars max)
  - Null byte detection in workspace paths
- **Bun test suite**: 10 test cases for utils

### Changed
- **Major refactor**: chat.message now handles wakeUp injection + auto-mining (removed duplicate hook)
- **system.transform**: Now only injects PALACE_PROTOCOL (not wakeUp on every message)
- **session.compacting**: Still loads wakeUp() for context rescue before compaction
- **package.json**: Fixed duplicate scripts/devDependencies

### Security
- Added path validation for workspaceDir
- Added input length limits for wing names
- Validated all Bun.spawn calls are safe from shell injection

## [0.1.8] - 2025-01-XX

### Added
- Toast notification at session start
- Project-based memory protocol (wing parameter)
- Auto-mining ported from option-K plugin
- MCP server auto-registration with 19 tools
- Auto-update mechanism (checks NPM registry)
- Diary tracking with session reminders
- `mempalace_check_diary` custom tool

## [0.1.0] - 2025-01-XX

### Added
- Initial release
- Basic MCP server integration
- PALACE_PROTOCOL injection
- Background auto-mining support

---

## Migration Guide

### From option-K/opencode-plugin-mempalace

**Compatible**: All original features work the same way.

**New capabilities**:
1. MCP tools now available directly (no CLI needed)
2. Auto-update keeps plugin fresh
3. Diary tracking with reminders
4. Bun-based (faster than npm)

**Configuration changes**: None required. The plugin uses the same config format.
