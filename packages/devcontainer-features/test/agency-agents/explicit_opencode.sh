#!/bin/bash
set -e

source dev-container-features-test-lib

opencode_agents_dir="$HOME/.config/opencode/agents"

check "marker file exists for explicit opencode install" bash -c \
    "ls ~/.local/share/devcontainer-features/agency-agents.done 2>/dev/null | grep -q ."

check "opencode agents directory exists" test -d "$opencode_agents_dir"

check "opencode agents directory is not empty" bash -c \
    "ls '$opencode_agents_dir'/*.md 2>/dev/null | grep -q ."

reportResults