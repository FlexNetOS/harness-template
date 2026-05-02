#!/usr/bin/env bash
# Installs @google/gemini-cli globally if available; otherwise installs an
# npx-based wrapper at /usr/local/bin/gemini.
# Idempotent: re-running with the same version is a no-op.
set -euo pipefail

FEATURE_ID="gemini-cli"
PACKAGE="@google/gemini-cli"
FALLBACK_REPO="https://github.com/google-gemini/gemini-cli"
VERSION="${VERSION:-latest}"

log()  { echo "[${FEATURE_ID}] $*" >&2; }
fail() { echo "[${FEATURE_ID}] ERROR: $*" >&2; exit 1; }

install_packages() {
  if command -v apt-get >/dev/null 2>&1; then
    export DEBIAN_FRONTEND=noninteractive
    apt-get update -y
    apt-get install -y --no-install-recommends "$@"
    rm -rf /var/lib/apt/lists/*
    return
  fi
  if command -v apk >/dev/null 2>&1; then apk add --no-cache "$@"; return; fi
  if command -v dnf >/dev/null 2>&1; then dnf install -y "$@"; return; fi
  if command -v microdnf >/dev/null 2>&1; then microdnf install -y "$@"; return; fi
  if command -v yum >/dev/null 2>&1; then yum install -y "$@"; return; fi
  if command -v zypper >/dev/null 2>&1; then zypper --non-interactive install --no-recommends "$@"; return; fi
  fail "No supported package manager found to install: $*"
}

ensure_node() {
  if command -v node >/dev/null 2>&1 && command -v npm >/dev/null 2>&1; then
    return 0
  fi
  log "node/npm not found. Attempting distro install (consider adding ghcr.io/devcontainers/features/node beforehand)."
  if command -v apt-get >/dev/null 2>&1; then
    install_packages curl ca-certificates
    curl -fsSL https://deb.nodesource.com/setup_lts.x | bash -
    install_packages nodejs
  else
    install_packages nodejs npm
  fi
  command -v npm >/dev/null 2>&1 || fail "npm install failed"
}

case "$VERSION" in
  ""|*[![:alnum:]._\\-]*)
    fail "Invalid version: '$VERSION'"
    ;;
esac

marker_dir="/usr/local/share/devcontainer-features"
marker_file="${marker_dir}/${FEATURE_ID}-${VERSION}.done"

if [ -f "$marker_file" ]; then
  log "Already installed (version=${VERSION}). Skipping."
  exit 0
fi

ensure_node

write_npx_wrapper() {
  log "Falling back to npx wrapper at /usr/local/bin/gemini (source: ${FALLBACK_REPO})"
  cat > /usr/local/bin/gemini <<'WRAPPER'
#!/usr/bin/env bash
# gemini-cli npx fallback wrapper.
# The npm package @google/gemini-cli was unavailable at install time, so this
# wrapper exec's the official upstream via npx.
set -euo pipefail
exec npx --yes https://github.com/google-gemini/gemini-cli "$@"
WRAPPER
  chmod +x /usr/local/bin/gemini
}

log "Attempting to install ${PACKAGE}@${VERSION} globally..."
if npm install -g --no-audit --no-fund "${PACKAGE}@${VERSION}" 2>/dev/null; then
  if command -v gemini >/dev/null 2>&1; then
    log "Installed via npm: $(gemini --version 2>/dev/null || echo 'gemini installed')"
  else
    log "npm install reported success but 'gemini' is not on PATH; using npx wrapper."
    write_npx_wrapper
  fi
else
  log "npm install failed (package may not be published). Using npx wrapper."
  write_npx_wrapper
fi

if ! command -v gemini >/dev/null 2>&1; then
  fail "Failed to provide a 'gemini' binary on PATH"
fi

mkdir -p "$marker_dir"
touch "$marker_file"

log "Done."
