#!/bin/bash
set -e

source dev-container-features-test-lib

check "sops binary on PATH" command -v sops
check "sops --version exits 0" sops --version

check "age binary on PATH" command -v age
check "age --version exits 0" age --version

check "age-keygen binary on PATH" command -v age-keygen

reportResults
