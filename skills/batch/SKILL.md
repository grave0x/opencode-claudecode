---
name: batch
description: Execute batch operations across multiple files or repos with pattern matching. Use for bulk renames, formatting, linting, or refactoring.
---

# Batch Skill

## Protocol
1. Confirm operation scope and dry-run first
2. Use glob patterns to select files
3. Execute in parallel where possible
4. Report summary: files scanned, files changed, errors

## Safety
- Always dry-run before mutating
- Require explicit user confirmation for destructive ops
- Use git stash before bulk operations on dirty working tree
