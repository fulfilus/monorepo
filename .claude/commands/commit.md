---
name: commit
description: Stage changes and create a well-formatted commit
arguments:
  - name: scope
    description: Commit scope (feat/fix/chore/refactor/docs)
    required: false
---

1. Run `git status` and `git diff --stat` to see what changed
2. Stage the relevant files (not unrelated changes)
3. Write a conventional commit message:
   - Format: `$scope: concise description`
   - If scope not provided, infer from the changes
   - Body: explain WHY, not what (the diff shows what)
   - Keep subject under 72 chars
4. Show me the commit message before executing
