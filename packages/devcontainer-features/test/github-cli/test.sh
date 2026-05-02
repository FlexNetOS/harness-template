#!/usr/bin/env bash
# Smoke test for the github-cli feature.
# Loaded by the devcontainers/action test harness.
set -euo pipefail

# devcontainer-features test scripts have a shared lib injected into the env.
# shellcheck disable=SC1091
source dev-container-features-test-lib

check "gh is on PATH"        bash -lc "command -v gh"
check "gh --version exits 0" bash -lc "gh --version"
check "apt source present"   bash -lc "test -f /etc/apt/sources.list.d/github-cli.list"
check "keyring present"      bash -lc "test -f /usr/share/keyrings/githubcli-archive-keyring.gpg"

reportResults
