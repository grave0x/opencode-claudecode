---
name: debug
description: Systematic root-cause debugging loop. Use when tests fail, builds break, behavior is wrong, or any unexpected error occurs.
---

# Debug Skill

## Protocol
1. Reproduce the failure. Capture exact error/stack trace.
2. Form hypothesis. What could cause this?
3. Test hypothesis. Add logging, check values, narrow scope.
4. If wrong → refine hypothesis. Repeat.
5. If confirmed → implement fix + regression test.

## Golden rule
One hypothesis at a time. Don't change multiple things and hope.

## Binary chop principle
Find the exact commit or code path that introduced the failure. Cut search space in half each round.
