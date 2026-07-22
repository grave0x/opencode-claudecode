# Leaked Frontier Model System Prompts

Reference collection of leaked/extracted system prompts from major AI models for prompt engineering, behavior analysis, and defense research.

## System Prompt Manager

This project includes a full system-prompt manager with CLI, plugin, skill, and slash command:

| Component | Path | Description |
|-----------|------|-------------|
| Registry | `registry.json` | Single source of truth — all prompts with metadata |
| Schema | `registry.schema.json` | JSON Schema for registry validation |
| Raw cache | `raw/<id>.txt` | Cached raw prompt text (fetch on demand) |
| Key patterns | `<id>-key-patterns.md` | Extracted behavioral patterns |
| Slash command | `commands/prompt.md` | `/prompt` interface |
| Skill | `skills/system-prompt-manager/SKILL.md` | Agent training for prompt management |
| CLI tool | `tools/system-prompts.js` | All CRUD operations from shell |
| Plugin | `plugins/system-prompts/plugin.js` | Tool registration + lifecycle hooks |

Quick start: `/prompt list` → `/prompt view <id>` → `/prompt fetch <id>` → `/prompt use <id>`

## Sources

| Repo | Stars | Description |
|------|-------|-------------|
| [asgeirtj/system_prompts_leaks](https://github.com/asgeirtj/system_prompts_leaks) | — | Raw dumps of Claude Opus 4.8, Claude Code, GPT-5.5, Gemini 3.5 Flash |
| [YeeKal/leaked-system-prompts](https://github.com/YeeKal/leaked-system-prompts) | 25K+ | 116 prompts, 33 companies, structured, searchable at leaked-system-prompts.com |
| [elder-plinius/CL4R1T4S](https://github.com/elder-plinius/CL4R1T4S) | 45K+ | Multi-vendor archive |
| [xai-org/grok-prompts](https://github.com/xai-org/grok-prompts) | official | xAI's official Grok prompt repository |

## Registered Prompts

Run `/prompt list` for live registry. Current entries:

| ID | Model | Source |
|----|-------|--------|
| claude-opus-4.7 | Anthropic Claude Opus 4.7 | leaked-system-prompts.com |
| claude-code | Anthropic Claude Code | YeeKal repo |
| gpt-5.5-thinking | OpenAI GPT-5.5 Thinking | asgeirtj repo |
| grok-4.3-beta | xAI Grok 4.3 Beta | xai-org/grok-prompts |
| gemini-3.1-pro | Google Gemini 3.1 Pro | asgeirtj repo |
| cursor-2.0 | Cursor 2.0 | YeeKal repo |
| codex | OpenAI Codex | YeeKal repo |
| claude-fable-5 | Anthropic Claude Fable 5 | asgeirtj repo |
| claude-opus-4.8 | Anthropic Claude Opus 4.8 | asgeirtj repo |
| perplexity | Perplexity AI | asgeirtj repo |
| kimi-k2.6 | Moonshot Kimi K2.6 | asgeirtj repo |

## Raw Prompt Files

Fetch with `/prompt fetch <id>` or `node tools/system-prompts.js fetch <id>`.
Prompts cached locally in `raw/<id>.txt` for offline use.

## Key Pattern Files

- `claude-opus-4.7-key-patterns.md` — Claude Opus 4.7 behavioral rules
- `claude-code-key-patterns.md` — Claude Code coding agent rules
- `gpt-5.5-thinking-key-patterns.md` — GPT-5.5 Thinking rules
