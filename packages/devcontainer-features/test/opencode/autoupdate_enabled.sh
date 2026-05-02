#!/bin/bash
set -e

source dev-container-features-test-lib

check "opencode binary exists" test -f /usr/local/bin/opencode

check "opencode is installed in PATH" command -v opencode

reportResults