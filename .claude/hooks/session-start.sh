#!/bin/bash
# Session start hook: Runs when a new Claude session begins
# Use this to set up environment or display project context

echo "=== Session Started ==="
echo "Project: $(basename $(pwd))"
echo "Branch: $(git branch --show-current 2>/dev/null || echo 'N/A')"
echo "Node: $(node -v 2>/dev/null || echo 'not installed')"
echo "Last commit: $(git log --oneline -1 2>/dev/null || echo 'no commits')"

# Check for uncommitted changes
CHANGES=$(git status --short 2>/dev/null | wc -l | tr -d ' ')
if [ "$CHANGES" -gt 0 ]; then
  echo "⚠️  $CHANGES uncommitted change(s)"
fi

echo "======================"
