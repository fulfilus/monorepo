---
name: testing
description: Testing best practices skill
triggers:
  - "*.test.*"
  - "*.spec.*"
  - jest.config.*
  - vitest.config.*
  - pytest.ini
---

# Testing Skill

Principles:
- Test behavior, not implementation
- Each test should have one clear assertion
- Use descriptive names: `should [expected behavior] when [condition]`
- Arrange-Act-Assert pattern
- Prefer integration tests over unit tests for business logic
- Mock external dependencies, not internal modules
- Test edge cases: empty inputs, boundaries, error paths
- Keep tests fast — mock I/O, use in-memory databases
- Don't test framework code or third-party libraries
