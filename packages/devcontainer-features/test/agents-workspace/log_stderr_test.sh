#!/bin/bash
set -e

POSTSTART_SCRIPT="/workspaces/devcontainer-features/src/agents-workspace/postStartCommand.sh"

echo "Testing postStartCommand.sh for stderr output bug..."

if ! grep -q 'echo "\[agents-workspace-poststart\] \$\*" >&2' "$POSTSTART_SCRIPT"; then
  echo "FAIL: log() function does NOT redirect to stderr"
  exit 1
fi

echo "PASS: log() function redirects to stderr correctly"
echo "PASS: All tests passed"