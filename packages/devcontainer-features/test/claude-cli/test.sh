#!/bin/bash
set -e

source dev-container-features-test-lib

check "claude binary on PATH" command -v claude
check "claude --version exits 0" claude --version

reportResults
