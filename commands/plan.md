# /plan

Enter plan mode. Agent must:
1. Produce numbered plan with each step's files and expected changes
2. Wait for user approval before executing any mutating tool
3. Deny Write/Edit/Bash-with-side-effects if plan not approved
4. Allow Read/Grep/Glob/ListDir freely during planning

Usage:
- `/plan` — enter plan mode (re-enter if in auto mode)
- `/plan "build auth"` — enter plan mode with task description

When in plan mode, every turn begins with plan status summary.
