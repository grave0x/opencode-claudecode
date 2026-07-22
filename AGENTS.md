<!-- plan-mode-rules -->
**PLAN MODE (ALWAYS ON):**
When user invokes /plan or task is complex (multi-file, multi-step), you MUST:
1. Produce numbered plan with each step's files and expected changes
2. Wait for user approval before executing any mutating tool
3. Deny mutations (Write, Edit, Bash with side effects) if plan not approved
4. Step through approved plan one step at a time; update plan if new info surfaces
5. Permit Read/Grep/Glob/ListDir freely during planning

Cycle: /plan → propose → /approve → execute → /reject → revise
Commands: /approve (accept all), /reject [step N] (reject specific), /rewrite-step N "change"

Modes: user says /yolo to skip plan mode (auto-approve all), /plan to re-enter
<!-- /plan-mode-rules -->

<!-- session-commands -->
**SESSION COMMANDS:**
- `/rewind [N]` — undo to checkpoint N (restores files)
- `/fork` — branch session into new ID
- `/checkpoint "label"` — manual snapshot
- `/compact` — compress history
- `/context` — show token usage + session stats
- `/session-info` — session metadata (id, created, turns, cost)
<!-- /session-commands -->

<!-- model-control -->
**MODEL CONTROL:**
- `/model <name>` — switch model mid-session
- `/effort low|medium|high` — set reasoning effort
- `/cost` — show token cost breakdown
<!-- /model-control -->

<!-- auto-approve-rules -->
**AUTO-APPROVE SYSTEM:**
Permission modes (set via /permissions <mode>):
- `manual` — standard per-tool approval (default)
- `acceptEdits` — auto-approve writes to working directory
- `plan` — plan mode only (nothing auto-approved)
- `auto` — classifier-based auto-approve
- `yolo` — full auto-approve all tools

Toggle: /yolo (cycle through modes), /permissions <mode> (set specific)
<!-- /auto-approve-rules -->

<!-- memory-rules -->
**CROSS-SESSION MEMORY:**
- `/remember "fact"` — save fact to memory (auto-tagged with cwd)
- `/memory search <query>` — search stored memories
- `/memory list` — list all memories
- `/memory clear` — wipe memory
- `/flush` — agent generates session summary, saves to memory
- At session start: top-5 relevant memories auto-injected into context
<!-- /memory-rules -->

<!-- background-agents -->
**BACKGROUND AGENTS:**
- `/bg "task"` — delegate task to background agent, returns immediately
- `/bg list` — show all background agents + status
- `/bg attach <id>` — rejoin background session
- `/bg stop <id>` — kill background agent
- `/bg log <id>` — show output so far
- Background agents run in isolated headless mode
<!-- /background-agents -->

<!-- hooks-system -->
**HOOKS SYSTEM:**
Lifecycle hooks configured in `.opencode/hooks.yaml`:
- `before:file_write`, `after:file_write` — pre/post file modifications
- `before:file_delete`, `after:file_delete` — pre/post file deletion
- `before:shell_command`, `after:shell_command` — pre/post shell commands
- `before:commit`, `after:commit` — pre/post git commits
- `on:error` — on tool failure

Each hook supports: command (shell/http), pattern (glob filter), timeout, deny_exit_code
<!-- /hooks-system -->

<!-- goal-mode -->
**GOAL MODE:**
When user invokes /goal "description":
- Agent works autonomously until goal condition met
- No per-turn approval needed
- Reports progress periodically
- Pauses on errors, asks for guidance
- `/goal status` — current progress
- `/goal pause` — pause execution
- `/goal resume` — continue
- `/goal stop` — terminate
<!-- /goal-mode -->

<!-- skills-reminder -->
**SKILLS & DYNAMIC LOADING:**
Skills live in `skills/` directory. Each skill is `SKILL.md` with `name` and `description`.
- Dynamic loading only — never preload all
- Use skill tool to load when task matches description
- Custom agents in `agents/` directory
- Commands in `commands/` directory
<!-- /skills-reminder -->

<!-- repomap-rules -->
**REPOMAP (when available):**
- `@repomap` — explicit call to generate AST symbol map of codebase
- Repomap provides ranked symbols (functions, classes, types) with call graph
- Used for context when working in large/unfamiliar codebases
<!-- /repomap-rules -->

<!-- export-rules -->
**SESSION EXPORT:**
- `/export` — export full session as Markdown
- `/export --format json` — export as JSON event log
- `/export --since "2h ago"` — export from time range
- Output saved to `./opencode-export-<timestamp>.md`
<!-- /export-rules -->

<!-- subagent-orchestration -->
**SUBAGENT ORCHESTRATION (when available):**
For complex multi-file tasks, orchestrator can:
1. Decompose task into dependency graph of subtasks
2. Spawn parallel subagents in isolated worktrees
3. Each subagent has focused context on its subtask
4. Orchestrator merges results, resolves conflicts
5. Presents unified diff for review

Invoked via `/batch "task"` or automatically for large tasks
<!-- /subagent-orchestration -->

<!-- system-prompts -->
**SYSTEM PROMPT MANAGER:**
Reference collection of leaked frontier model system prompts for prompt engineering, behavior analysis, and defense research.

Commands:
- `/prompt list` — list all registered prompts
- `/prompt view <id>` — view metadata + raw content
- `/prompt fetch <id> | --all` — download raw prompt from source
- `/prompt create <id> --url <url>` — add new prompt from URL
- `/prompt search <query>` — search across all prompts
- `/prompt compare <id1> <id2>` — diff two prompts
- `/prompt use <id>` — inject as active reference prompt
- `/prompt export <id> [--format md|json|txt]` — export prompt
- `/prompt edit <id> --key <field> --value <val>` — edit metadata
- `/prompt remove <id>` — delete from registry
- `/prompt validate` — check registry integrity

Registry: `system-prompts/registry.json` (single source of truth)
Raw prompts: `system-prompts/raw/<id>.txt`
Key patterns: `system-prompts/<id>-key-patterns.md`
Skill: `skills/system-prompt-manager/SKILL.md`
CLI tool: `tools/system-prompts.js`
Plugin: `plugins/system-prompts/plugin.js`

Known sources: asgeirtj/system_prompts_leaks, YeeKal/leaked-system-prompts, elder-plinius/CL4R1T4S, xai-org/grok-prompts
Online mirror: leaked-system-prompts.com
<!-- /system-prompts -->
