---
name: error-handling
severity: error
description: Always handle errors explicitly
---

Rules:
- Never use empty catch blocks
- Always log or rethrow errors with context
- Use custom error classes for domain errors
- Return Result types instead of throwing where appropriate
- Validate inputs at system boundaries
- Provide user-friendly error messages
