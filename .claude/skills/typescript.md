---
name: typescript
description: TypeScript development skill
triggers:
  - "*.ts"
  - "*.tsx"
  - tsconfig.json
---

# TypeScript Skill

When working with TypeScript files:

- Prefer `interface` over `type` for object shapes (better error messages, extendable)
- Use strict mode (`"strict": true` in tsconfig)
- Prefer `unknown` over `any`; narrow types explicitly
- Use discriminated unions for state machines
- Leverage `satisfies` operator for type-safe object literals
- Use `as const` for literal types
- Prefer `Record<K, V>` over index signatures when keys are known
- Handle `null`/`undefined` explicitly, never use non-null assertion (`!`) in production code
- Use barrel exports (`index.ts`) sparingly — they hurt tree-shaking
