---
name: review
description: Review code for quality, security, and best practices
arguments:
  - name: file
    description: File path to review
    required: true
---

Review the file `$file` for:

1. **Code Quality** - naming, structure, readability, DRY violations
2. **Security** - injection risks, exposed secrets, auth issues
3. **Performance** - unnecessary allocations, N+1 queries, missing indexes
4. **Error Handling** - unhandled cases, swallowed errors, missing validation
5. **Testing** - is this code testable? Are edge cases covered?

Provide actionable feedback with specific line references. Rate severity as: 🔴 Critical, 🟡 Warning, 🟢 Suggestion.
