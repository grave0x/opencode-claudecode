# /prompt

Manage, view, and create system prompts from leaked frontier models.

## Usage

```
/prompt list                        — List all registered prompts
/prompt list --tag anthropic        — Filter by tag
/prompt view <id>                   — View prompt metadata + raw content
/prompt view <id> --patterns        — View extracted key patterns only
/prompt create <id>                 — Create new prompt entry (interactive)
/prompt fetch <id>                  — Download raw prompt from source_url
/prompt fetch --all                 — Fetch all prompts missing local copy
/prompt search <query>              — Search across all prompt content
/prompt compare <id1> <id2>         — Diff two prompts
/prompt export <id> [--format md|json|txt]  — Export prompt to file
/prompt use <id>                    — Inject prompt into current session context
/prompt edit <id>                   — Edit metadata or raw content
/prompt remove <id>                 — Delete prompt from registry
```

## Examples

```bash
/prompt list
/prompt view claude-opus-4.7
/prompt search "refusal"
/prompt fetch claude-fable-5
/prompt compare gpt-5.5-thinking claude-opus-4.7
/prompt use claude-code --inject
```

Registry: `system-prompts/registry.json`
Raw prompts: `system-prompts/raw/<id>.txt`
Key patterns: `system-prompts/<id>-key-patterns.md`
