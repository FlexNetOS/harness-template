#!/usr/bin/env bash
set -euo pipefail

echo_prefix="[opencode-poststart]"

autoupdate="${AUTOUPDATE:-true}"

if ! command -v opencode >/dev/null 2>&1; then
    echo "$echo_prefix opencode not found, installing..."
    curl -fsSL https://opencode.ai/install | bash
fi

if [ "$autoupdate" = "true" ]; then
    echo "$echo_prefix running autoupgrade..."
    opencode upgrade --yes 2>/dev/null || true
fi

echo "$echo_prefix done"