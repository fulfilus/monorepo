#!/bin/bash
# Session start hook — outputs JSON for both user systemMessage and model additionalContext

PROJECT=$(basename "$(pwd)")
BRANCH=$(git branch --show-current 2>/dev/null || echo 'N/A')
NODE=$(node -v 2>/dev/null || echo 'not installed')
LAST_COMMIT=$(git log --oneline -1 2>/dev/null || echo 'no commits')
CHANGES=$(git status --short 2>/dev/null | wc -l | tr -d ' ')

SYS_LINES=(
  "=== Session Started ==="
  "Project: $PROJECT"
  "Branch: $BRANCH"
  "Node: $NODE"
  "Last commit: $LAST_COMMIT"
)
if [ "$CHANGES" -gt 0 ]; then
  SYS_LINES+=("⚠️  $CHANGES uncommitted change(s)")
fi
SYS_LINES+=("======================")
SYSTEM_MSG=$(printf '%s\n' "${SYS_LINES[@]}")

STEERING_FILE="$HOME/.claude/engineer-defaults.md"
if [ -f "$STEERING_FILE" ]; then
  ADDITIONAL_CONTEXT=$(cat "$STEERING_FILE")
else
  ADDITIONAL_CONTEXT=""
fi

# jq handles all escaping — never construct JSON by hand
jq -n \
  --arg msg "$SYSTEM_MSG" \
  --arg ctx "$ADDITIONAL_CONTEXT" \
  '{
    systemMessage: $msg,
    hookSpecificOutput: {
      hookEventName: "SessionStart",
      additionalContext: $ctx
    }
  }'
