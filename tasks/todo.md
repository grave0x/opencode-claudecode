# Feature Implementation Todo

## Phase 1: Foundation

### Task 1.1: AGENTS.md — system prompt rules
- [ ] Add plan mode rules: "Before mutating files, produce numbered plan, wait approval"
- [ ] Add session command registry
- [ ] Add memory workflow rules
- [ ] Add hooks system docs
- [ ] Add background agent rules

### Task 1.2: Core slash commands
- [ ] `commands/plan.md` — Enter plan mode
- [ ] `commands/approve.md` — Approve proposed plan
- [ ] `commands/reject.md` — Reject plan or step
- [ ] `commands/rewind.md` — Undo to checkpoint
- [ ] `commands/fork.md` — Branch session
- [ ] `commands/goal.md` — Autonomous mode
- [ ] `commands/loop.md` — Recurring prompt
- [ ] `commands/model.md` — Switch model
- [ ] `commands/effort.md` — Set reasoning effort
- [ ] `commands/cost.md` — Show token cost
- [ ] `commands/context.md` — Show context usage
- [ ] `commands/yolo.md` — Toggle auto-approve
- [ ] `commands/remember.md` — Save fact to memory
- [ ] `commands/memory.md` — Search/manage memory
- [ ] `commands/flush.md` — Save session to memory
- [ ] `commands/bg.md` — Background agent
- [ ] `commands/session-info.md` — Session metadata
- [ ] `commands/export.md` — Export session
- [ ] `commands/checkpoint.md` — Manual snapshot
- [ ] `commands/compact.md` — Manual compression

## Phase 2: Skills
- [ ] `skills/code-review/SKILL.md`
- [ ] `skills/deep-research/SKILL.md`
- [ ] `skills/security-review/SKILL.md`
- [ ] `skills/batch/SKILL.md`
- [ ] `skills/debug/SKILL.md`
- [ ] `skills/init/SKILL.md`
- [ ] `skills/verify/SKILL.md`
- [ ] `skills/doctor/SKILL.md`

## Phase 3: Plan Mode Plugin
- [ ] `plugins/plan-mode/plugin.js` — State machine + tool blocking
- [ ] Plan review UX (approve/reject/rewrite-step)
- [ ] State persistence via flag files

## Phase 4: Session Checkpoint Plugin
- [ ] `plugins/checkpoint/plugin.js` — Checkpoint capture
- [ ] Rewind restoration logic

## Phase 5: Memory Plugin
- [ ] `plugins/memory/plugin.js` — Storage/search
- [ ] Auto-inject at session start

## Phase 6: Background Agent Plugin
- [ ] `plugins/background/plugin.js` — Subprocess manager
- [ ] /bg list/attach/stop commands

## Phase 7: Auto-Approval System
- [ ] `plugins/auto-approve/plugin.js` — Permission mode machine

## Phase 8: Custom Tool Registration
- [ ] `plugins/custom-tools/plugin.js` — Tool registrations

## Phase 9: Hooks Engine Plugin
- [ ] `plugins/hooks-engine/plugin.js` — Config parser + lifecycle

## Phase 10: Repomap Tool
- [ ] `tools/repomap/index.js` — AST extraction + ranking

## Phase 11: Subagent Orchestration
- [ ] Task decomposition plugin
- [ ] Worktree isolation + merge

## Phase 12: Polish
- [x] Theme system
- [x] Session export
- [ ] Keyboard shortcuts

## Phase 13: System Prompt Manager
- [x] `system-prompts/registry.json` — central index with schema
- [x] `system-prompts/raw/` — local raw prompt cache
- [x] `system-prompts/registry.schema.json` — JSON Schema validation
- [x] `commands/prompt.md` — /prompt slash command
- [x] `skills/system-prompt-manager/SKILL.md` — skill for agent training
- [x] `tools/system-prompts.js` — CLI tool for all CRUD ops
- [x] `plugins/system-prompts/plugin.js` — tool registration + lifecycle hooks
- [x] `opencode.json` — register plugin
- [x] `AGENTS.md` — add system-prompts section with all commands
- [ ] `system-prompts/README.md` — update to include manager docs
