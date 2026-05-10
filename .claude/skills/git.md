---
name: git
description: Git workflow skill
triggers:
  - .git
  - .gitignore
---

# Git Skill

Workflow conventions:

- **Branching**: `feat/short-description`, `fix/issue-number`, `chore/task`
- **Commits**: Conventional commits — `feat:`, `fix:`, `chore:`, `refactor:`, `docs:`, `test:`
- **PRs**: Keep focused, one concern per PR. Include description of what/why/how-to-test.
- **Never**: force push to shared branches, commit secrets, rewrite published history
- **Always**: pull before push, rebase feature branches on main, squash fixup commits

Before committing:
1. `git diff --staged` to review
2. Run tests
3. Run linter
