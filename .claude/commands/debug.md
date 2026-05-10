---
name: debug
description: Investigate and fix a bug
arguments:
  - name: issue
    description: Description of the bug or error message
    required: true
---

Debug: `$issue`

Approach:
1. Reproduce - find the minimal reproduction path
2. Isolate - narrow down to the specific module/function
3. Diagnose - identify root cause (not just symptoms)
4. Fix - implement the minimal correct fix
5. Verify - run tests, confirm the fix works
6. Prevent - suggest how to prevent recurrence (test, lint rule, type)
