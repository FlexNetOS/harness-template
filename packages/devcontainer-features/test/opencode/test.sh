#!/bin/bash
set -e

source dev-container-features-test-lib

check "opencode binary exists" test -f /usr/local/bin/opencode

check "opencode-fix-permissions script exists" test -f /usr/local/bin/opencode-fix-permissions

check "opencode postStartCommand script exists for autoupdate" test -f /usr/local/share/devcontainer-features/opencode-postStartCommand.sh

reportResults
