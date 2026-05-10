---
name: test
description: Run tests and report results clearly
arguments:
  - name: target
    description: Specific test file or pattern (optional)
    required: false
---

1. Detect the test runner from project config (jest, vitest, pytest, go test, etc.)
2. Run tests: `$target` if specified, otherwise full suite
3. Report results:
   - ✅ Passed: count
   - ❌ Failed: count with failure details
   - ⏭️ Skipped: count
4. If failures exist, analyze root cause and suggest fixes
