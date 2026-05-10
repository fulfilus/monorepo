---
name: no-any
severity: error
description: Disallow use of 'any' type in TypeScript
pattern: ": any"
fix: Use 'unknown' and narrow the type, or define a proper interface
---

Never use `any` in TypeScript code. Prefer:
- `unknown` with type narrowing
- Proper interfaces/types
- Generic type parameters
- `Record<string, unknown>` for dynamic objects
