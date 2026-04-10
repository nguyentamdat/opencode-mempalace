# Memory Debugging Skill

## Description

Debugging skill for MemPalace memory system. Helps diagnose memory-related issues, check palace status, and verify configuration.

## Usage

This skill is automatically available when working with opencode-mempalace issues.

## Tools

### mempalace_status

Check palace overview:
```typescript
mempalace_mempalace_status
```

### mempalace_search

Search project memory:
```typescript
mempalace_mempalace_search({ query: "auth implementation", wing: "wing_project-name" })
```

### mempalace_kg_query

Query knowledge graph:
```typescript
mempalace_mempalace_kg_query({ entity: "MyProject" })
```

## Debugging Checklist

When investigating memory issues:

1. **Check Palace Status**
   - Run `mempalace_mempalace_status()`
   - Verify palace directory exists
   - Check wing count

2. **Verify Wing Configuration**
   - Run `mempalace_mempalace_list_rooms({ wing: "current_project" })`
   - Ensure workspace maps to correct wing

3. **Search Existing Memories**
   - Run `mempalace_mempalace_search({ wing: "current_project", query: "relevant_topic" })`
   - Verify memories are being stored

4. **Check Diary Entries**
   - Run `mempalace_mempalace_diary_read({ agent_name: "your_agent" })`
   - Verify session tracking

## Common Issues

### "No memory found for this workspace"
- Palace may not be initialized
- Wing name may be different than expected
- Check `isInitialized()` in logs

### "Mining failed"
- mempalace CLI may not be installed
- Check PATH for `mempalace` or `python3 -m mempalace`
- Review logs in `~/.cache/opencode/log/opencode-mempalace.log`

### "Protocol not injected"
- Plugin may have `disableProtocol: true`
- Check plugin configuration
- Verify system hook is firing
