#!/bin/bash
set -e

source dev-container-features-test-lib

check "gemini binary on PATH" command -v gemini
check "gemini --version exits 0" gemini --version

reportResults
