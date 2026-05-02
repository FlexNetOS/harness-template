#!/bin/bash
set -e

source dev-container-features-test-lib

TARGET_USER="${_REMOTE_USER:-node}"
TARGET_HOME="/home/$TARGET_USER"

check "skills installed for correct user" bash -c "test -d $TARGET_HOME/.config/opencode/skills || test -d $TARGET_HOME/.claude/skills"

reportResults