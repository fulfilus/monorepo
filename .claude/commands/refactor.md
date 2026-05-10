---
name: refactor
description: Refactor code while preserving behavior
arguments:
  - name: file
    description: File to refactor
    required: true
  - name: goal
    description: What to improve (readability/performance/modularity)
    required: false
---

Refactor `$file` with goal: `$goal` (default: readability).

Rules:
- Preserve all existing behavior (no functional changes)
- Run tests before and after to verify
- Make changes incrementally
- Explain each transformation applied
