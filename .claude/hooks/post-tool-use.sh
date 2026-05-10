#!/bin/bash
# Post-tool-use hook: Runs after Claude uses a tool
# Useful for logging, auditing, or triggering side effects

TOOL_NAME="${1:-unknown}"
TIMESTAMP=$(date +"%Y-%m-%d %H:%M:%S")

# Log tool usage (uncomment to enable)
# echo "[$TIMESTAMP] Tool used: $TOOL_NAME" >> ".claude/hooks/tool-usage.log"

# Auto-format after file writes (uncomment and adjust for your project)
# if [[ "$TOOL_NAME" == "write_file" || "$TOOL_NAME" == "edit_file" ]]; then
#   npx prettier --write . --log-level silent 2>/dev/null
# fi
