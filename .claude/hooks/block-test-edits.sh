#!/bin/sh
# PreToolUse hook (matcher: Edit|Write).
# The "deny" rule in settings.json for tests/** is a documented but
# sometimes-unreliable mechanism (see anthropics/claude-code#6699) — this
# hook is the real gate. Exit 2 blocks the tool call and shows the message
# to Claude; exit 0 allows it.

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | grep -o '"file_path"[[:space:]]*:[[:space:]]*"[^"]*"' | sed -E 's/.*"file_path"[[:space:]]*:[[:space:]]*"([^"]*)"/\1/')

case "$FILE_PATH" in
  *tests/*|tests/*)
    echo "Blocked: edits to $FILE_PATH are not allowed. If a test is failing, fix the implementation instead." >&2
    exit 2
    ;;
esac

exit 0
