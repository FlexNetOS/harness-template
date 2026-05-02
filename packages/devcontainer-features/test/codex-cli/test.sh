#!/bin/bash
set -e

source dev-container-features-test-lib

check "codex binary on PATH" command -v codex
check "codex --version exits 0" codex --version

reportResults
