#!/bin/bash
set -e

detect_user() {
  local user=""
  if [ -n "${_REMOTE_USER:-}" ]; then
    user="$_REMOTE_USER"
  elif [ -n "$USERNAME" ]; then
    user="$USERNAME"
  else
    user="$(getent passwd 1000 | cut -d: -f1)" || true
    [ -z "$user" ] && user="$(whoami 2>/dev/null)" || true
    [ -z "$user" ] && user="node"
  fi

  if [ -d "/home/$user" ]; then
    echo "$user"
  elif [ -d "/root" ] && [ "$user" = "root" ]; then
    getent passwd | cut -d: -f1 | grep -v "^root$" | head -1 || echo "vscode"
  else
    echo "$user"
  fi
}

TARGET_USER="$(detect_user)"
TARGET_HOME="$(getent passwd "$TARGET_USER" | cut -d: -f6)"
[ -z "$TARGET_HOME" ] && TARGET_HOME="/home/$TARGET_USER"

echo "TARGET_USER: $TARGET_USER"
echo "TARGET_HOME: $TARGET_HOME"

if [ -z "$TARGET_USER" ]; then
  echo "FAILED: TARGET_USER is empty"
  exit 1
fi

if [ -z "$TARGET_HOME" ]; then
  echo "FAILED: TARGET_HOME is empty"
  exit 1
fi

if [ "$TARGET_USER" = "root" ]; then
  echo "FAILED: TARGET_USER should not be root"
  exit 1
fi

echo "SUCCESS: detect_user works correctly"