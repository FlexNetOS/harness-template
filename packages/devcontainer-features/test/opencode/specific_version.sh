#!/bin/bash
set -e

source dev-container-features-test-lib

check "opencode binary exists" test -f /usr/local/bin/opencode

check "opencode-fix-permissions script exists" test -f /usr/local/bin/opencode-fix-permissions

check "marker file exists for specific version 1.3.17" test -f /usr/local/share/devcontainer-features/opencode-v1-vscode-1.3.17.done

check "installed version is 1.3.17" bash -c "opencode --version | grep -q '1.3.17'"

reportResults
