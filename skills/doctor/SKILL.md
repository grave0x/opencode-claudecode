---
name: doctor
description: Diagnose and repair agent workspace issues — broken configs, missing deps, stale state, permission errors. Use when things aren't working right.
---

# Doctor Skill

## Checks
1. **Config** — opencode.json valid JSON, plugin paths exist, required fields present
2. **Deps** — npm/pip packages installed, versions match lockfile
3. **State** — no stale lockfiles, no orphaned processes, temp dir writable
4. **Permissions** — file/dir permissions correct for write operations
5. **Git** — no merge conflicts, not in detached HEAD unexpectedly
6. **Disk** — enough free space for operations

## Fixes
- Auto-fix where safe (install deps, fix permissions)
- Report unfixable issues with remediation steps
- Log all changes made
