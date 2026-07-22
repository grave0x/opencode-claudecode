---
name: system-prompt-manager
description: Manage, view, create, and inject system prompts from leaked frontier models. Use when user wants to browse prompts, fetch new leaks, compare model behaviors, create a custom prompt, or inject a prompt into session context.
---

# System Prompt Manager

## Overview

Centralizes all leaked/extracted system prompts in `system-prompts/registry.json`.
Raw prompt text in `system-prompts/raw/`. Key-pattern analyses in `system-prompts/`.

## Commands

| Cmd | Description |
|-----|-------------|
| `/prompt list` | List all registered prompts with metadata |
| `/prompt view <id>` | Show full prompt metadata + raw content |
| `/prompt fetch <id>` | Download raw prompt from known source URL |
| `/prompt create <id>` | Create new entry (paste raw text or from URL) |
| `/prompt search <query>` | Search across all prompt raw text |
| `/prompt compare <id1> <id2>` | Diff two prompts side by side |
| `/prompt use <id>` | Load prompt into agent context |
| `/prompt export <id>` | Export to file (markdown/json/txt) |
| `/prompt edit <id>` | Edit metadata or raw content |
| `/prompt remove <id>` | Delete from registry + files |

## Workflows

### Browse known prompts
```
/prompt list
/prompt view claude-opus-4.7
/prompt view claude-opus-4.7 --patterns
```

### Fetch and analyze a new leak
```
/prompt fetch claude-fable-5
/prompt view claude-fable-5
→ then write key-patterns file
```

### Create a custom prompt (e.g. for opencode itself)
```
/prompt create opencode-custom
→ pastes raw text or builds from template
→ tags: ["opencode", "custom"]
```

### Compare two model behaviors
```
/prompt compare gpt-5.5-thinking claude-opus-4.7
→ focus: refusal style, tool-use, safety approach
```

### Use a prompt in current session
```
/prompt use claude-code
→ injects raw prompt into context for reference
```

## Storage Layout

```
system-prompts/
  registry.json            ← Central index (single source of truth)
  registry.schema.json     ← JSON Schema for registry validation
  README.md                ← Sources, URLs, model index
  raw/                     ← Raw prompt text files (<id>.txt)
    claude-opus-4.7.txt
    gpt-5.5-thinking.txt
    ...
  <id>-key-patterns.md     ← Extracted behavioral patterns
```

## Tool

The `tools/system-prompts.js` CLI handles all CRUD. The plugin `plugins/system-prompts/plugin.js` registers prompt tools into the agent's toolchain.

## Anti-patterns

- DON'T store raw prompts inline in registry.json (they're too large)
- DON'T edit raw/ files and registry.json out of sync — always use the tool
- DON'T commit prompts from proprietary models to public repos without checking license
