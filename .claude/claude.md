# Project Instructions

## Identity

You are an AI assistant working on the Fulfilus monorepo. Follow these instructions for all interactions.

## Project Overview

- **Company**: Fulfilus (fulfilus@gmail.com)
- **Name**: fulfilus/monorepo
- **Type**: Polyglot monorepo — multiple languages and frameworks coexist
- **Package Manager**: pnpm (Node.js packages); language-native tools for others

## Architecture

<!-- Describe key architectural decisions -->
- Source code lives in `src/`
- Tests live in `tests/` or alongside source files as `*.test.*`
- Configuration in project root

## Code Style

- Use consistent naming conventions matching the existing codebase
- Prefer explicit over implicit
- Write self-documenting code; add comments only for "why", not "what"
- Keep functions small and focused
- Handle errors explicitly, never swallow exceptions

## Workflow

1. Read relevant code before making changes
2. Run tests after modifications: `npm test` (or project equivalent)
3. Run linter before committing: `npm run lint`
4. Keep commits atomic and well-described

## Conventions

- Branch naming: `feat/`, `fix/`, `chore/`, `refactor/`
- Commit messages: conventional commits format
- PR descriptions: include what changed, why, and how to test
- Never commit secrets or credentials

## Testing

- Write tests for new features and bug fixes
- Maintain existing test coverage
- Use descriptive test names that explain the scenario

## Dependencies

- Pin exact versions
- Prefer well-maintained, popular packages
- Document why non-obvious dependencies are needed

## Security

- Validate all inputs
- Use parameterized queries for database access
- Never log sensitive data
- Follow principle of least privilege
