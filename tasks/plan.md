# Implementation Plan: Agent-Harness Features for opencode

## Overview
Port features from Grok Build, Claude Code, Pi, Aider, Cursor, Copilot CLI, Cline, Roo Code into opencode. Full hybrid: plugins (JS) + companion tools + MCP servers + config (commands/skills/agents).

## Architecture Decisions
- **Commands** as `.md` templates in `commands/` — zero-code, instantly modifiable
- **Plugins** as JS ES modules using `@opencode-ai/plugin` API — for hooks, tools, state
- **Skills** as `SKILL.md` files — reusable workflow prompts
- **State persistence** via flag files (`~/.config/opencode/.feature-active`) — simplest shared state
- **Background agents** via `opencode run -p` subprocess — reuses full agent
- **Memory** as Markdown files in `~/.config/opencode/memory/` — grep-friendly, composable
- **Checkpoints** in `~/.opencode-sessions/<cwd-hash>/checkpoints.jsonl` — survives git clean
- **Hooks config** in `.opencode/hooks.yaml` — version-controllable, familiar format
- **MCP servers** for sandbox/dashboard — proper protocol boundary

## Task List

### Phase 1: Foundation (Commands + System Prompt)
- [ ] Task 1.1: AGENTS.md — system prompt rules for plan mode, session commands, memory
- [ ] Task 1.2: Core slash commands (19 commands)

### Checkpoint: Foundation
- [ ] Directory structure created, commands loadable, AGENTS.md valid

### Phase 2: Skills (Reusable Workflows)
- [ ] Task 2.1: code-review skill
- [ ] Task 2.2: deep-research skill
- [ ] Task 2.3: security-review skill
- [ ] Task 2.4: batch, debug, init, verify, doctor skills

### Checkpoint: Skills
- [ ] All skills discoverable via `ls skills/`, loadable via skill tool

### Phase 3: Plan Mode Plugin
- [ ] Task 3.1: Plan mode state machine + tool blocking
- [ ] Task 3.2: Plan review UX (approve/reject/rewrite step)

### Phase 4: Session Checkpoint Plugin
- [ ] Task 4.1: Checkpoint capture on file changes
- [ ] Task 4.2: Rewind/checkpoint commands

### Phase 5: Memory Plugin
- [ ] Task 5.1: Memory storage + search
- [ ] Task 5.2: Auto-inject at session start

### Phase 6: Background Agent Plugin
- [ ] Task 6.1: Subprocess manager for headless agents
- [ ] Task 6.2: /bg commands (list/attach/stop)

### Phase 7: Auto-Approval System
- [ ] Task 7.1: Permission mode state machine
- [ ] Task 7.2: Mode switching commands

### Phase 8: Custom Tool Registration
- [ ] Task 8.1: Register web_search, web_fetch, tree_sitter_query, lint, test_watch, checkpoint_revert, session_export tools

### Phase 9: Hooks Engine Plugin
- [ ] Task 9.1: Hooks config parser (YAML)
- [ ] Task 9.2: Hook execution lifecycle (before/after events)

### Phase 10: Repomap Tool
- [ ] Task 10.1: AST-based symbol extraction with tree-sitter
- [ ] Task 10.2: Call graph + PageRank ranking

### Phase 11: Subagent Orchestration
- [ ] Task 11.1: Task decomposition with dependency graph
- [ ] Task 11.2: Parallel subagent execution with worktree isolation

### Phase 12: Polish
- [ ] Task 12.1: Theme system
- [ ] Task 12.2: Session export
- [ ] Task 12.3: Keyboard shortcuts

### Final Checkpoint
- [ ] All acceptance criteria met
- [ ] Integration test passes
- [ ] Ready for review

## Risks and Mitigations
| Risk | Impact | Mitigation |
|------|--------|------------|
| Plugin API maturity gaps | High | Target stable hooks; open issues for missing ones |
| Background agent subprocess management | Medium | PID files + health checks; --timeout + --max-turns guards |
| Plan mode tool blocking | Medium | Start with simple approved/denied; iterate on UX |
| Memory search fidelity | Low | Grep + tags is good enough; upgrade to vector search later |
| Worktree isolation overhead | Medium | Only for subagent orchestration; skip for simple tasks |

## Open Questions
- Does opencode `tool.execute.before` support returning `deny` to block execution? Need to verify hook signature.
- Does `opencode run -p` support `--output-format json` for structured output parsing?
- Does opencode have built-in `--worktree` support or must we implement via `git worktree` in plugin?
