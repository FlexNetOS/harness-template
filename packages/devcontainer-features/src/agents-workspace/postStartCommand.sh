#!/bin/bash
set -euo pipefail

MARKER="${HOME}/.local/share/devcontainer-features/agents-workspace.done"
COMMIT_FILE="${HOME}/.local/share/devcontainer-features/agents-workspace.commit"
AGENCY_COMMIT_FILE="${HOME}/.local/share/devcontainer-features/agency-agents.commit"

TARGET_USER="${USER:-$(whoami)}"
[ -z "$TARGET_USER" ] && TARGET_USER="$(getent passwd | awk -F: '$3 >= 1000 {print $1; exit 0}')"
[ -z "$TARGET_USER" ] && TARGET_USER="vscode"

export USERNAME="$TARGET_USER"
export _REMOTE_USER="$TARGET_USER"
export TOOL="${TOOL:-all}"
export INCLUDEAGENCY="${INCLUDEAGENCY:-true}"
export AUTOUPDATE="${AUTOUPDATE:-true}"

log() {
  echo "[agents-workspace-poststart] $*" >&2
}

fail() {
  echo "[agents-workspace-poststart] ERROR: $*" >&2
  exit 1
}

get_remote_commit() {
  local repo="$1"
  curl -fsSL "https://api.github.com/repos/$repo/commits/main" 2>/dev/null | \
    grep -o '"sha": "[a-f0-9]*' | cut -d'"' -f4 | cut -c1-7
}

download_install_script() {
  local tmp_script="/tmp/agents-workspace-install.sh"
  log "Downloading install script..."
  local download_failed=false
  if command -v curl >/dev/null 2>&1; then
    if ! curl -fsSL "https://raw.githubusercontent.com/wcgomes/agents-workspace/main/tools/install.sh" -o "$tmp_script" --fail; then
      download_failed=true
    fi
  else
    if ! wget -qO "$tmp_script" "https://raw.githubusercontent.com/wcgomes/agents-workspace/main/tools/install.sh" 2>/dev/null; then
      download_failed=true
    fi
  fi
  if [ "$download_failed" = "true" ]; then
    fail "Failed to download install.sh"
  fi
  chmod +x "$tmp_script"
  [ -f "$tmp_script" ] || fail "Downloaded install script not found: $tmp_script"
  log "Downloaded install script successfully"
  echo "$tmp_script"
}

do_install() {
  log "Starting installation for user '$TARGET_USER'..."

  local tool="${TOOL:-all}"
  local includeAgency="${INCLUDEAGENCY:-true}"

  local TARGET_HOME
  TARGET_HOME="$(getent passwd "$TARGET_USER" | cut -d: -f6)"
  [ -z "$TARGET_HOME" ] && TARGET_HOME="/home/$TARGET_USER"

  local tmp_dir
  tmp_dir="$(mktemp -d /tmp/agents-workspace-XXXXXX)"
  CLEANUP_DIR="$tmp_dir"
  cleanup() {
    rm -rf "$CLEANUP_DIR"
    rm -f /tmp/agents-workspace-install.sh
  }
  trap cleanup EXIT

  local install_script
  install_script="$(download_install_script)"
  log "Running install script from $install_script..."
  export HOME="$TARGET_HOME"
  bash "$install_script" --all || log "Install completed with warnings"

  local remote_final_commit
  remote_final_commit="$(get_remote_commit "wcgomes/agents-workspace")"
  [ -n "$remote_final_commit" ] && mkdir -p "$(dirname "$COMMIT_FILE")" && echo "$remote_final_commit" > "$COMMIT_FILE" && log "Saved agents-workspace commit: $remote_final_commit"

  if [ "$includeAgency" = "true" ]; then
    local remote_agency_commit
    remote_agency_commit="$(get_remote_commit "msitarzewski/agency-agents")"
    [ -n "$remote_agency_commit" ] && mkdir -p "$(dirname "$AGENCY_COMMIT_FILE")" && echo "$remote_agency_commit" > "$AGENCY_COMMIT_FILE" && log "Saved agency-agents commit: $remote_agency_commit"
  fi

  log "Installation completed for tool '$tool'."
}

check_for_updates() {
  local includeAgency="$INCLUDEAGENCY"

  if [ -f "$COMMIT_FILE" ] && [ -s "$COMMIT_FILE" ]; then
    local installed_agents_workspace_commit
    installed_agents_workspace_commit="$(cat "$COMMIT_FILE")"
    if [ -n "$installed_agents_workspace_commit" ]; then
      local remote_agents_workspace_commit
      remote_agents_workspace_commit="$(get_remote_commit "wcgomes/agents-workspace")"

      local needs_update=false
      if [ -n "$remote_agents_workspace_commit" ] && [ "$remote_agents_workspace_commit" != "$installed_agents_workspace_commit" ]; then
        log "agents-workspace update available ($installed_agents_workspace_commit → $remote_agents_workspace_commit)"
        needs_update=true
      fi

      if [ "$includeAgency" = "true" ] && [ -f "$AGENCY_COMMIT_FILE" ]; then
        local installed_agency_agents_commit
        installed_agency_agents_commit="$(cat "$AGENCY_COMMIT_FILE")"
        if [ -n "$installed_agency_agents_commit" ]; then
          local remote_agency_agents_commit
          remote_agency_agents_commit="$(get_remote_commit "msitarzewski/agency-agents")"
          if [ -n "$remote_agency_agents_commit" ] && [ "$remote_agency_agents_commit" != "$installed_agency_agents_commit" ]; then
            log "agency-agents update available ($installed_agency_agents_commit → $remote_agency_agents_commit)"
            needs_update=true
          fi
        fi
      fi

      if [ "$needs_update" = "true" ]; then
        log "Updates available, updating..."
        rm -f "$MARKER"
        rm -f "$COMMIT_FILE"
        [ "$includeAgency" = "true" ] && rm -f "$AGENCY_COMMIT_FILE"
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