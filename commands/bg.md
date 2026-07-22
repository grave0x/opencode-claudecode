# /bg

Delegate task to background agent. Agent runs in isolated headless subprocess.

Usage:
- `/bg "run tests in watch mode"` — delegate task
- `/bg list` — show running background agents
- `/bg attach <id>` — rejoin background session interactively
- `/bg stop <id>` — kill background agent
- `/bg log <id>` — show output so far
- `/bg log <id> --tail 50` — last 50 lines
