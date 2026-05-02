#!/bin/bash
set -e

source dev-container-features-test-lib

check "autoupdate enabled - user marker exists" bash -c \
    "ls ~/.local/share/devcontainer-features/agency-agents.done 2>/dev/null | grep -q ."

reportResults