# Project Instructions

## Identity

You are an AI assistant working on the Fulfilus monorepo. Follow these instructions for all interactions.

## Approach

- Read existing files before writing. Don't re-read unless changed.
- Thorough in reasoning, concise in output.
- Skip files over 100KB unless required.
- No sycophantic openers or closing fluff.
- No emojis or em-dashes.
- Do not guess APIs, versions, flags, commit SHAs, or package names. Verify by reading code or docs before asserting.

## Project Overview

- **Company**: Fulfilus — grocery automation and fulfillment technology; robotics, inventory intelligence, operational scalability, and AI-assisted workflows
- **Name**: fulfilus/monorepo
- **Type**: Polyglot monorepo — multiple languages and frameworks coexist
- **Package Manager**: pnpm (Node.js packages); language-native tools for others
- **Frontend**: Angular standalone architecture, reusable forms, AI suggestion highlighting, strong typing
- **Backend**: REST APIs, structured logging, validation, audit logging, background jobs, secure uploads
- **Database**: PostgreSQL — vendors, categories, AI insights, enrichment jobs, documents, audit logs, confidence scoring

## Domain

The platform is an AI-assisted Vendor Intelligence and Vendor Onboarding system. Core workflows: onboarding, AI enrichment, OCR, and operational intelligence.

AI-generated fields must include confidence scores, source tracking, model metadata, and timestamps.

Enrichment sources: Google Maps, JustDial, IndiaMart, OCR, and LLM extraction.

## Reference Docs

Full guidelines live in `docs/`. Always read before implementing:

- `docs/fulfil-context.md` — company context
- `docs/vendor-domain.md` — domain and platform overview
- `docs/architecture-principles.md` — clean architecture, provider patterns, async pipelines, typed DTOs
- `docs/backend-guidelines.md` — API and service conventions
- `docs/frontend-guidelines.md` — Angular patterns
- `docs/db-guidelines.md` — schema and auditability conventions
- `docs/ai-enrichment-rules.md` — AI field requirements
- `docs/prompts/` — task-specific prompts for common implementation patterns

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
