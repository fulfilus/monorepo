#!/bin/bash
# Pre-compact hook: Runs before context window compaction
# Use this to save important state before context is compressed

TIMESTAMP=$(date +"%Y-%m-%d %H:%M:%S")
COMPACT_LOG=".claude/hooks/compact.log"

echo "[$TIMESTAMP] Context compaction triggered" >> "$COMPACT_LOG"

# Save current working state summary
echo "[$TIMESTAMP] Active branch: $(git branch --show-current 2>/dev/null || echo 'N/A')" >> "$COMPACT_LOG"
echo "[$TIMESTAMP] Uncommitted changes: $(git status --short 2>/dev/null | wc -l | tr -d ' ')" >> "$COMPACT_LOG"
echo "---" >> "$COMPACT_LOG"
