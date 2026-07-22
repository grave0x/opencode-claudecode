---
name: verify
description: Check work by running builds, tests, linting, and type-checking. Use after making changes to confirm nothing is broken.
---

# Verify Skill

## Protocol
1. Run type checker (tsc --noEmit or equivalent)
2. Run linter (eslint, biome, etc.)
3. Run unit tests (vitest/jest, pytest, etc.)
4. Run build (tsc build, vite build, etc.)
5. Report: pass/fail per category, any new warnings

## Autofix
- Auto-apply lint fixes where safe
- Report unfixable issues for manual intervention

## Failure handling
If any step fails: report errors, suggest fix, re-verify after fix.
