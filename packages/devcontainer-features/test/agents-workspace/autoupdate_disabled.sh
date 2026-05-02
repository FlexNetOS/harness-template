#!/bin/bash
set -e

source dev-container-features-test-lib

check "autoupdate disabled - user marker exists" bash -c \
    "ls ~/.local/share/devcontainer-features/agents-workspace.done 2>/dev/null | grep -q ."

reportResults