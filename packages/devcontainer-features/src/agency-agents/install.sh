#!/bin/sh
set -eu

log() {
  echo "[agency-agents-feature] $*" >&2
}

fail() {
  echo "[agency-agents-feature] ERROR: $*" >&2
  exit 1
}

install_packages() {
  if command -v apt-get >/dev/null 2>&1; then
    export DEBIAN_FRONTEND=noninteractive
    apt-get update -y
    apt-get install -y --no-install-recommends "$@"
    rm -rf /var/lib/apt/lists/*
    return
  fi

  if command -v apk >/dev/null 2>&1; then
    apk add --no-cache "$@"
    return
  fi

  if command -v dnf >/dev/null 2>&1; then
    dnf install -y "$@"
    return
  fi

  if command -v microdnf >/dev/null 2>&1; then
    microdnf install -y "$@"
    return
  fi

  if command -v yum >/dev/null 2>&1; then
    yum install -y "$@"
    return
  fi

  if command -v zypper >/dev/null 2>&1; then
    zypper --non-interactive install --no-recommends "$@"
    return
  fi

  fail "Missing package manager support to install dependencies: $*"
}

ensure_prerequisites() {
  missing=""

  if ! command -v unzip >/dev/null 2>&1; then
    missing="${missing} unzip"
  fi

  if ! command -v curl >/dev/null 2>&1 && ! command -v wget >/dev/null 2>&1; then
    missing="${missing} curl"
  fi

  if [ ! -f /etc/ssl/certs/ca-certificates.crt ]; then
    missing="${missing} ca-certificates"
  fi

  missing="$(echo "$missing" | sed 's/^ *//')"

  [ -n "$missing" ] || return 0

  if [ "$(id -u)" -ne 0 ]; then
    fail "Missing dependencies: $missing. Rebuild as root or preinstall them in the base image."
  fi

  log "Installing missing dependencies: $missing"
  install_packages $missing

  command -v unzip >/dev/null 2>&1 || fail "Dependency installation failed: unzip"
  command -v curl >/dev/null 2>&1 || command -v wget >/dev/null 2>&1 || fail "Dependency installation failed: curl/wget"
  [ -f /etc/ssl/certs/ca-certificates.crt ] || fail "Dependency installation failed: CA certificates"
}

ensure_prerequisites

marker_dir="/usr/local/share/devcontainer-features"
mkdir -p "$marker_dir"

poststart_script="$(dirname "$0")/postStartCommand.sh"
if [ -f "$poststart_script" ]; then
  cp "$poststart_script" "$marker_dir/agency-agents-postStartCommand.sh"
  chmod +x "$marker_dir/agency-agents-postStartCommand.sh"
fi

log "Scripts copied. Installation will run in postStartCommand."