---
name: no-console
severity: warning
description: Avoid console.log in production code
pattern: "console.log"
fix: Use a proper logger (e.g., pino, winston) or remove the log
---

Do not use `console.log` in production code. Acceptable alternatives:
- Structured logger (pino, winston, bunyan)
- `console.error` for actual errors in CLI tools
- `debug` package for development-only logging
- Remove entirely if it was debugging output
