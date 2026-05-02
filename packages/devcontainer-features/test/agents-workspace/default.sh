#!/bin/bash
set -e

source dev-container-features-test-lib

check "postStartCommand script exists" bash -c \
    "ls /usr/local/share/devcontainer-features/agents-workspace-postStartCommand.sh 2>/dev/null | grep -q ."

check "user marker exists" bash -c \
    "ls ~/.local/share/devcontainer-features/agents-workspace.done 2>/dev/null | grep -q ."

reportResults