#!/bin/bash
set -euo pipefail

MARKER="${HOME}/.local/share/devcontainer-features/agency-agents.done"
COMMIT_FILE="${HOME}/.local/share/devcontainer-features/agency-agents.commit"

TARGET_USER="${USER:-$(whoami)}"
[ -z "$TARGET_USER" ] && TARGET_USER="$(getent passwd | awk -F: '$3 >= 1000 {print $1; exit 0}')"
[ -z "$TARGET_USER" ] && TARGET_USER="vscode"

export USERNAME="$TARGET_USER"
export _REMOTE_USER="$TARGET_USER"
export TOOL="${TOOL:-auto}"
export AUTOUPDATE="${AUTOUPDATE:-true}"

log() {
  echo "[agency-agents-poststart] $*" >&2
}

fail() {
  echo "[agency-agents-poststart] ERROR: $*" >&2
  exit 1
}

get_remote_commit() {
  curl -fsSL "https://api.github.com/repos/msitarzewski/agency-agents/commits/main" 2>/dev/null | \
    grep -o '"sha": "[a-f0-9]*' | cut -d'"' -f4 | cut -c1-7
}

do_install() {
  log "Starting installation for user '$TARGET_USER'..."

  local tool="${TOOL:-auto}"

  local TARGET_HOME
  TARGET_HOME="$(getent passwd "$TARGET_USER" | cut -d: -f6)"
  [ -z "$TARGET_HOME" ] && TARGET_HOME="/home/$TARGET_USER"

  local tmp_dir
  tmp_dir="$(mktemp -d /tmp/agency-agents-XXXXXX)"
  CLEANUP_DIR="$tmp_dir"
  cleanup() {
    rm -rf "$CLEANUP_DIR"
  }
  trap cleanup EXIT

  local zip_file="$tmp_dir/agency-agents.zip"

  log "Downloading repository ZIP..."
  local download_failed=false
  if command -v curl >/dev/null 2>&1; then
    if ! curl -fsSL "https://github.com/msitarzewski/agency-agents/archive/refs/heads/main.zip" -o "$zip_file" --fail; then
      if ! curl -fsSL "https://github.com/msitarzewski/agency-agents/archive/refs/heads/master.zip" -o "$zip_file" --fail; then
        download_failed=true
      fi
    fi
  else
    if ! wget -qO "$zip_file" "https://github.com/msitarzewski/agency-agents/archive/refs/heads/main.zip" 2>/dev/null; then
      if ! wget -qO "$zip_file" "https://github.com/msitarzewski/agency-agents/archive/refs/heads/master.zip" 2>/dev/null; then
        download_failed=true
      fi
    fi
  fi
  if [ "$download_failed" = "true" ]; then
    fail "Unable to download repository ZIP (main/master)."
  fi
  [ -f "$zip_file" ] || fail "Downloaded ZIP not found: $zip_file"

  log "Extracting repository ZIP..."
  unzip -q "$zip_file" -d "$tmp_dir"

  local repo_dir
  repo_dir="$(find "$tmp_dir" -mindepth 1 -maxdepth 1 -type d | head -n1 || true)"
  [ -n "$repo_dir" ] || fail "Could not locate extracted repository directory."

  [ -f "$repo_dir/scripts/convert.sh" ] || fail "Missing script: scripts/convert.sh"
  [ -f "$repo_dir/scripts/install.sh" ] || fail "Missing script: scripts/install.sh"

  chmod +x "$repo_dir/scripts/convert.sh" "$repo_dir/scripts/install.sh"

  log "Running convert.sh..."
  (
    cd "$repo_dir"
    ./scripts/convert.sh
  )

  if [ "$tool" = "auto" ]; then
    log "Running install.sh --no-interactive --parallel (auto tool detection)..."
  else
    log "Running install.sh --tool $tool --no-interactive..."
  fi

  local opencode_agents_src="$repo_dir/integrations/opencode/agents"
  local opencode_agents_global="$TARGET_HOME/.config/opencode/agents"

  should_install_opencode() {
    case "$tool" in
      auto|all|opencode) return 0 ;;
      *) return 1 ;;
    esac
  }

  log "Installing for user '$TARGET_USER' (HOME=$TARGET_HOME)..."
  chown -R "$TARGET_USER":"$TARGET_USER" "$tmp_dir"
  chmod -R u+rwX,go+rX "$tmp_dir"

  if [ "$(id -un)" = "$TARGET_USER" ]; then
    if [ "$tool" = "auto" ]; then
      cd "$repo_dir" && HOME="$TARGET_HOME" ./scripts/install.sh --no-interactive --parallel
    else
      cd "$repo_dir" && HOME="$TARGET_HOME" ./scripts/install.sh --tool "$tool" --no-interactive
    fi
  else
    if [ "$tool" = "auto" ]; then
      su - "$TARGET_USER" -c "cd '$repo_dir' && HOME='$TARGET_HOME' ./scripts/install.sh --no-interactive --parallel"
    else
      su - "$TARGET_USER" -c "cd '$repo_dir' && HOME='$TARGET_HOME' ./scripts/install.sh --tool '$tool' --no-interactive"
    fi
  fi

  if should_install_opencode && [ -d "$opencode_agents_src" ]; then
    log "Installing OpenCode agents globally to $opencode_agents_global..."
    mkdir -p "$opencode_agents_global"
    cp "$opencode_agents_src"/*.md "$opencode_agents_global/" 2>/dev/null || true
    chown -R "$TARGET_USER":"$TARGET_USER" "$opencode_agents_global"
    log "OpenCode agents installed globally."
  fi

  local remote_final_commit
  remote_final_commit="$(get_remote_commit)"
  if [ -n "$remote_final_commit" ]; then
    mkdir -p "$(dirname "$COMMIT_FILE")"
    echo "$remote_final_commit" > "$COMMIT_FILE"
  fi

  log "Installation completed for tool '$tool'."
}

check_for_updates() {
  if [ -f "$COMMIT_FILE" ] && [ -s "$COMMIT_FILE" ]; then
    local installed_commit
    installed_commit="$(cat "$COMMIT_FILE")"
    if [ -n "$installed_commit" ]; then
      local remote_commit
      remote_commit="$(get_remote_commit)"
      if [ -n "$remote_commit" ] && [ "$remote_commit" != "$installed_commit" ]; then
        log "Update available ($installed_commit → $remote_commit), updating..."
        rm -f "$MARKER"
        rm -f "$COMMIT_FILE"
        do_install
        mkdir -p "$(dirname "$MARKER")"
        touch "$MARKER"
        log "Update complete"
        exit 0
      fi
    fi
  fi
  log "Already on latest version"
}

if [ -f "$MARKER" ]; then
  if [ "$AUTOUPDATE" = "true" ]; then
    log "Marker found, checking for updates..."
    check_for_updates
  else
    log "Marker found, autoupdate disabled, skipping"
  fi
  exit 0
fi

log "First installation..."
do_install

mkdir -p "$(dirname "$MARKER")"
touch "$MARKER"
log "Installation complete, marker created at $MARKER"