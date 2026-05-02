#!/usr/bin/env bash
# tools/install.sh
#
# Outside-container installer for users who want to use individual harness
# pieces without the full devcontainer. Detects platform and installs `sops`
# and `age` via the right package manager. Optionally installs the three
# supported AI CLIs (claude, codex, gemini) when --with-cli is passed.
#
# Idempotent: re-running is safe — every step checks for existing installs
# before acting.
#
# Usage:
#   tools/install.sh [--with-cli] [--dry-run] [--no-sops] [--no-age]
#
# Exit codes:
#   0 success (or already installed)
#   1 unrecoverable error (no recognized package manager, etc.)

set -euo pipefail

DRY_RUN=0
WITH_CLI=0
SKIP_SOPS=0
SKIP_AGE=0

while [ $# -gt 0 ]; do
  case "$1" in
    --with-cli) WITH_CLI=1 ;;
    --dry-run)  DRY_RUN=1 ;;
    --no-sops)  SKIP_SOPS=1 ;;
    --no-age)   SKIP_AGE=1 ;;
    -h|--help)
      sed -n '2,20p' "$0" | sed 's/^# \{0,1\}//'
      exit 0
      ;;
    *)
      echo "Unknown flag: $1" >&2
      exit 64
      ;;
  esac
  shift
done

run() {
  if [ "$DRY_RUN" = "1" ]; then
    echo "[dry-run] $*"
  else
    echo "+ $*"
    "$@"
  fi
}

have() { command -v "$1" >/dev/null 2>&1; }

detect_pm() {
  case "$(uname -s)" in
    Darwin)
      if have brew; then echo "brew"; return; fi
      ;;
    Linux)
      if have apt-get;  then echo "apt";    return; fi
      if have dnf;      then echo "dnf";    return; fi
      if have pacman;   then echo "pacman"; return; fi
      if have apk;      then echo "apk";    return; fi
      if have brew;     then echo "brew";   return; fi
      ;;
    MINGW*|MSYS*|CYGWIN*)
      if have scoop; then echo "scoop"; return; fi
      if have choco; then echo "choco"; return; fi
      ;;
  esac
  echo "unknown"
}

PM="$(detect_pm)"
echo "Detected package manager: $PM"

install_pkg() {
  local pkg="$1"
  if have "$pkg"; then
    echo "$pkg already installed — skipping."
    return 0
  fi
  case "$PM" in
    brew)   run brew install "$pkg" ;;
    apt)    run sudo apt-get update -y && run sudo apt-get install -y "$pkg" ;;
    dnf)    run sudo dnf install -y "$pkg" ;;
    pacman) run sudo pacman -S --noconfirm "$pkg" ;;
    apk)    run sudo apk add --no-cache "$pkg" ;;
    scoop)  run scoop install "$pkg" ;;
    choco)  run choco install -y "$pkg" ;;
    *)
      echo "ERROR: no recognized package manager. Install '$pkg' manually." >&2
      return 1
      ;;
  esac
}

if [ "$SKIP_SOPS" = "0" ]; then install_pkg sops; fi
if [ "$SKIP_AGE"  = "0" ]; then install_pkg age;  fi

if [ "$WITH_CLI" = "1" ]; then
  echo "Installing AI CLIs (claude, codex, gemini) where available..."
  # Each CLI is best-effort — we don't fail the whole install on a single miss.
  for cli in claude codex gemini; do
    if have "$cli"; then
      echo "$cli already installed — skipping."
      continue
    fi
    case "$PM" in
      brew)  run brew install "$cli" || echo "WARN: brew install $cli failed (formula may not exist)" ;;
      scoop) run scoop install "$cli" || echo "WARN: scoop install $cli failed" ;;
      choco) run choco install -y "$cli" || echo "WARN: choco install $cli failed" ;;
      apt|dnf|pacman|apk)
        echo "WARN: $cli not packaged for $PM — install via the vendor's docs."
        ;;
      *)
        echo "WARN: unknown package manager — install $cli manually."
        ;;
    esac
  done
fi

echo "Done."
