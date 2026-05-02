#!/bin/bash
set -e

source dev-container-features-test-lib

check "agents-workspace-postStartCommand.sh exists for postStart" bash -c \
    "ls /usr/local/share/devcontainer-features/agents-workspace-postStartCommand.sh 2>/dev/null | grep -q ."

check "agents-workspace marker new exists" bash -c \
    "ls ~/.local/share/devcontainer-features/agents-workspace.done 2>/dev/null | grep -q ."

reportResults