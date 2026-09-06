#!/bin/sh
# PreToolUse hook (matcher: Bash).
# Same reasoning as block-test-edits.sh: settings.json "deny" entries for
# these patterns aren't guaranteed to be enforced by every Claude Code
# version, so this hook is the actual gate. Exit 2 blocks, exit 0 allows.

INPUT=$(cat)
COMMAND=$(echo "$INPUT" | grep -o '"command"[[:space:]]*:[[:space:]]*"[^"]*"' | sed -E 's/.*"command"[[:space:]]*:[[:space:]]*"([^"]*)"/\1/')

echo "$COMMAND" | grep -Eq -- '--force|(^| )-f( |$).*push|git push.*(-f|--force)' && {
  echo "Blocked: force-push is not allowed. History on main is never rewritten." >&2
  exit 2
}

echo "$COMMAND" | grep -Eq 'rm[[:space:]]+-[a-zA-Z]*r[a-zA-Z]*f|rm[[:space:]]+-[a-zA-Z]*f[a-zA-Z]*r' && {
  echo "Blocked: recursive force-delete is not allowed via this hook. Delete specific files instead." >&2
  exit 2
}

exit 0
