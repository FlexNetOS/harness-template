#!/bin/bash
set -e

source dev-container-features-test-lib

check "agency-agents-postStartCommand.sh exists for postStart" bash -c \
    "ls /usr/local/share/devcontainer-features/agency-agents-postStartCommand.sh 2>/dev/null | grep -q ."

check "agency-agents marker new exists" bash -c \
    "ls ~/.local/share/devcontainer-features/agency-agents.done 2>/dev/null | grep -q ."

reportResults