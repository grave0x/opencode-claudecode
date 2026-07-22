---
name: code-review
description: Review diffs and code for correctness, security, regression, performance, and maintainability. Use when reviewing a PR, diff, or any code before merge.
---

# Code Review Skill

## Protocol
1. Read spec/issue to establish intent
2. Read diff/code
3. Identify issues: correctness, security, regression, performance, test gaps, maintainability
4. Report per-file with severity tags

## Severity
- 🔴 BLOCKER: wrong output, crash, security hole, data loss
- 🟡 RISK: edge case, race, leak, perf cliff, missing guard
- 🔵 NIT: style, naming, micro-perf (skip unless thorough requested)

## Output format
```
path/to/file.ts:42: 🔴 BLOCKER: <problem>. <fix>.
path/to/file.ts:118: 🟡 RISK: <problem>. <fix>.
totals: 1🔴 2🟡
```

Zero findings → "No issues found."
