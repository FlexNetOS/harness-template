#!/usr/bin/env bash
# Installs sops (getsops/sops) and age (FiloSottile/age) into /usr/local/bin
# with SHA256 verification against pinned hashes.
#
# Idempotent: re-running with the same versions is a no-op.
set -euo pipefail

FEATURE_ID="sops-age"
SOPS_VERSION="${SOPSVERSION:-3.9.4}"
AGE_VERSION="${AGEVERSION:-1.2.1}"

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

ensure_prereqs() {
  local missing=""
  command -v curl    >/dev/null 2>&1 || missing="$missing curl"
  command -v sha256sum >/dev/null 2>&1 || missing="$missing coreutils"
  command -v tar     >/dev/null 2>&1 || missing="$missing tar"
  missing="$(echo "$missing" | sed 's/^ *//')"
  [ -z "$missing" ] && return 0
  install_packages $missing
}

detect_arch() {
  local arch
  if command -v dpkg >/dev/null 2>&1; then
    arch="$(dpkg --print-architecture)"
    case "$arch" in
      amd64) echo "amd64"; return ;;
      arm64) echo "arm64"; return ;;
      armhf) echo "arm"; return ;;
    esac
  fi
  arch="$(uname -m)"
  case "$arch" in
    x86_64|amd64)  echo "amd64" ;;
    aarch64|arm64) echo "arm64" ;;
    armv7l)        echo "arm" ;;
    *) fail "Unsupported architecture: $arch" ;;
  esac
}

# Pinned SHA256 sums for known (version, arch) tuples.
# Lookup format:  "<tool>-<version>-<arch>" -> sha256
#
# sops hashes verified against https://github.com/getsops/sops/releases/download/v3.9.4/sops-v3.9.4.checksums.txt
# age hashes are best-effort: age publishes `.proof` (sigstore transparency-log
#   inclusion proofs), not flat checksum files. CI re-verifies on every build.
#   To upgrade: download the tarball, run sha256sum, replace below.
sha_for() {
  local key="$1"
  case "$key" in
    # ---- sops 3.9.4 (Linux) — verified from official checksums.txt ----
    sops-3.9.4-amd64) echo "5488e32bc471de7982ad895dd054bbab3ab91c417a118426134551e9626e4e85" ;;
    sops-3.9.4-arm64) echo "16564c6b181d88505d9e0dfef62771894293d85cde5884d9b1a843859eee174b" ;;
    # ---- age 1.2.1 (Linux) — amd64 verified from observed build, arm64 TBD ----
    age-1.2.1-amd64)  echo "7df45a6cc87d4da11cc03a539a7470c15b1041ab2b396af088fe9990f7c79d50" ;;
    age-1.2.1-arm64)  echo "" ;;
    *) echo "" ;;
  esac
}

verify_sha256() {
  local file="$1"
  local expected="$2"
  local actual
  actual="$(sha256sum "$file" | awk '{print $1}')"
  if [ "$actual" != "$expected" ]; then
    fail "Checksum mismatch for $file. expected=$expected actual=$actual"
  fi
}

download() {
  # download <url> <dest>
  local url="$1" dest="$2"
  log "Downloading $url"
  curl -fsSL --retry 3 --retry-delay 2 -o "$dest" "$url"
}

install_sops() {
  local version="$1" arch="$2"
  local url="https://github.com/getsops/sops/releases/download/v${version}/sops-v${version}.linux.${arch}"
  local tmp
  tmp="$(mktemp)"
  download "$url" "$tmp"
  local expected
  expected="$(sha_for "sops-${version}-${arch}")"
  if [ -z "$expected" ]; then
    log "WARN: no pinned SHA256 for sops ${version}/${arch}. Skipping verification."
    log "WARN: TODO: pin checksum after publish for sops-${version}-${arch}"
  else
    verify_sha256 "$tmp" "$expected"
  fi
  install -m 0755 "$tmp" /usr/local/bin/sops
  rm -f "$tmp"
}

install_age() {
  local version="$1" arch="$2"
  local url="https://github.com/FiloSottile/age/releases/download/v${version}/age-v${version}-linux-${arch}.tar.gz"
  local tmp tar_dir
  tmp="$(mktemp)"
  tar_dir="$(mktemp -d)"
  download "$url" "$tmp"
  local expected
  expected="$(sha_for "age-${version}-${arch}")"
  if [ -z "$expected" ]; then
    log "WARN: no pinned SHA256 for age ${version}/${arch}. Skipping verification."
    log "WARN: TODO: pin checksum after publish for age-${version}-${arch}"
  else
    verify_sha256 "$tmp" "$expected"
  fi
  tar -xzf "$tmp" -C "$tar_dir"
  install -m 0755 "$tar_dir/age/age"        /usr/local/bin/age
  install -m 0755 "$tar_dir/age/age-keygen"  /usr/local/bin/age-keygen
  rm -rf "$tmp" "$tar_dir"
}

# ---- main ---------------------------------------------------------------

# Validate version strings
case "$SOPS_VERSION" in
  ""|*[![:alnum:]._\\-]*) fail "Invalid sopsVersion: '$SOPS_VERSION'" ;;
esac
case "$AGE_VERSION" in
  ""|*[![:alnum:]._\\-]*) fail "Invalid ageVersion: '$AGE_VERSION'" ;;
esac

marker_dir="/usr/local/share/devcontainer-features"
marker_file="${marker_dir}/${FEATURE_ID}-sops${SOPS_VERSION}-age${AGE_VERSION}.done"

if [ -f "$marker_file" ]; then
  log "Already installed (sops=${SOPS_VERSION}, age=${AGE_VERSION}). Skipping."
  exit 0
fi

ensure_prereqs

ARCH="$(detect_arch)"
log "Detected arch: ${ARCH}"

log "Installing sops ${SOPS_VERSION}..."
install_sops "$SOPS_VERSION" "$ARCH"

log "Installing age ${AGE_VERSION}..."
install_age "$AGE_VERSION" "$ARCH"

# Smoke-check
sops --version >/dev/null 2>&1 || fail "sops failed to run after install"
age  --version >/dev/null 2>&1 || fail "age failed to run after install"

mkdir -p "$marker_dir"
touch "$marker_file"

log "Installed sops $(sops --version 2>/dev/null | head -n1) and age $(age --version 2>/dev/null | head -n1)"
log "Done."
