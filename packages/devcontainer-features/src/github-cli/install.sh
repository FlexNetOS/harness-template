#!/usr/bin/env bash
# Installs the GitHub CLI (gh) from the official cli.github.com apt repo.
# Idempotent — re-running with the same version is a no-op.
#
# Usage in a devcontainer.json:
#   "features": {
#     "ghcr.io/FlexNetOS/harness-template/github-cli:1": { "version": "latest" }
#   }
set -euo pipefail

FEATURE_ID="github-cli"
VERSION="${VERSION:-latest}"

log()  { echo "[${FEATURE_ID}] $*" >&2; }
fail() { echo "[${FEATURE_ID}] ERROR: $*" >&2; exit 1; }

ensure_root() {
  if [ "$(id -u)" -ne 0 ]; then
    fail "This feature must run as root (devcontainer features run as root by default)."
  fi
}

ensure_prereqs() {
  local missing=""
  command -v curl >/dev/null 2>&1 || missing="$missing curl"
  command -v dpkg >/dev/null 2>&1 || missing="$missing dpkg"
  if [ -n "$missing" ]; then
    apt-get update -y
    apt-get install -y --no-install-recommends $missing
  fi
}

install_gh() {
  local arch
  arch="$(dpkg --print-architecture)"

  log "Installing keyring for cli.github.com..."
  curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg \
    | dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg status=none
  chmod go+r /usr/share/keyrings/githubcli-archive-keyring.gpg

  log "Adding apt source for arch=${arch}..."
  echo "deb [arch=${arch} signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" \
    > /etc/apt/sources.list.d/github-cli.list

  log "Refreshing apt cache..."
  apt-get update -y

  if [ "$VERSION" = "latest" ]; then
    log "Installing gh (latest from apt)..."
    apt-get install -y --no-install-recommends gh
  else
    log "Installing gh=${VERSION}..."
    apt-get install -y --no-install-recommends "gh=${VERSION}"
  fi

  rm -rf /var/lib/apt/lists/*
}

# ---- main ---------------------------------------------------------------

ensure_root

marker_dir="/usr/local/share/devcontainer-features"
marker_file="${marker_dir}/${FEATURE_ID}-${VERSION}.done"

if [ -f "$marker_file" ] && command -v gh >/dev/null 2>&1; then
  log "Already installed (${VERSION}). Skipping."
  exit 0
fi

ensure_prereqs
install_gh

# Smoke check
gh --version >/dev/null 2>&1 || fail "gh failed to run after install"

mkdir -p "$marker_dir"
touch "$marker_file"

log "Installed: $(gh --version 2>/dev/null | head -n1)"
log "Auth (run as the human user inside the container, not here):"
log "  gh auth login        # device-code flow"
log "  gh auth status       # verify"
log "Done."
