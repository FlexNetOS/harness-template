#!/usr/bin/env bash
set -euo pipefail

log() {
  echo "[opencode] $*" >&2
}

fail() {
  echo "[opencode] ERROR: $*" >&2
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

  fail "Suporte a gerenciador de pacotes não encontrado para instalar dependências: $*"
}

ensure_prerequisites() {
  missing=""

  if ! command -v curl >/dev/null 2>&1; then
    missing="${missing} curl"
  fi

  if [ ! -f /etc/ssl/certs/ca-certificates.crt ]; then
    missing="${missing} ca-certificates"
  fi

  missing="$(echo "$missing" | sed 's/^ *//')"

  [ -n "$missing" ] || return 0

  if [ "$(id -u)" -ne 0 ]; then
    fail "Dependências ausentes: $missing. Reconstrua como root ou pré-instale-as na imagem base."
  fi

  log "Instalando dependências ausentes:$missing"
  install_packages $missing

  command -v curl >/dev/null 2>&1 || fail "Falha na instalação de dependências: curl ainda está ausente"
  [ -f /etc/ssl/certs/ca-certificates.crt ] || fail "Falha na instalação de dependências: certificados CA ainda estão ausentes"
}

autoupdate_check() {
  local autoupdate="$1"

  if [ "$autoupdate" != "true" ]; then
    return 0
  fi

  if ! command -v opencode >/dev/null 2>&1; then
    log "Autoupdate: skipped (opencode not in PATH)"
    return 0
  fi

  log "Autoupdate: checking for updates..."

  if opencode upgrade >/dev/null 2>&1; then
    log "Autoupdate: upgraded"
  else
    log "Autoupdate: failed"
  fi
}

detect_user() {
  local user=""
  local valid_user

  valid_user="$(getent passwd | awk -F: '$3 >= 1000 && $1 !~ /^(nobody|nfsnobody|daemon)$/ {print $1; exit 0}')" || true
  [ -z "$valid_user" ] && valid_user="root"

  if [ -n "${_REMOTE_USER:-}" ]; then
    user="$_REMOTE_USER"
  elif [ -n "$USERNAME" ]; then
    user="$USERNAME"
  fi

  if [ -n "$user" ]; then
    local user_shell
    user_shell="$(getent passwd "$user" 2>/dev/null | cut -d: -f7)" || true
    case "$user_shell" in
      */nologin|*/false|"")
        user="$valid_user"
        ;;
    esac
  fi

  if [ -z "$user" ]; then
    user="$valid_user"
  fi

  echo "$user"
}

TARGET_USER="$(detect_user)"
TARGET_HOME="$(getent passwd "$TARGET_USER" | cut -d: -f6)"
if [ -z "$TARGET_HOME" ] || [ "$TARGET_HOME" = "" ]; then
  TARGET_HOME="/home/$TARGET_USER"
fi

USERNAME="$TARGET_USER"
USER_HOME="$TARGET_HOME"
VERSION="${VERSION:-}"
AUTOUPDATE="${OPENCODE_AUTOUPDATE:-${AUTOUPDATE:-true}}"

# Validação do nome de usuário
case "$USERNAME" in
  "")
    fail "O nome de usuário não pode estar vazio."
    ;;
  *[!a-zA-Z0-9_-]*)
    fail "O nome de usuário contém caracteres inválidos: '$USERNAME'."
    ;;
esac

# Validação da versão
if [ -n "$VERSION" ] && [[ ! "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  fail "A versão deve estar no formato semântico (ex: 1.3.17): '$VERSION'."
fi

# Verificação de idempotência
marker_dir="/usr/local/share/devcontainer-features"
marker_file="$marker_dir/opencode-v1-${USERNAME}${VERSION:+-}${VERSION:-latest}.done"

if [ -f "$marker_file" ]; then
  log "Instalação já realizada para o usuário '$USERNAME'. Ignorando."
  exit 0
fi

ensure_prerequisites

log "Instalando CLI opencode para usuário: $USERNAME${VERSION:+ (versão: $VERSION)}"

version_flag=""
if [ -n "$VERSION" ]; then
  version_flag="--version $VERSION"
fi

su "$USERNAME" -c "curl -fsSL https://opencode.ai/install | bash -s -- --no-modify-path $version_flag"

ln -s "${USER_HOME}/.opencode/bin/opencode" /usr/local/bin/opencode

log "Criando diretórios para volumes persistentes..."

mkdir -p "${USER_HOME}/.config/opencode"
mkdir -p "${USER_HOME}/.local"
mkdir -p "${USER_HOME}/.local/share/opencode"
mkdir -p "${USER_HOME}/.local/state/opencode"

chown -R "${USERNAME}:${USERNAME}" \
	"${USER_HOME}/.config/opencode" \
	"${USER_HOME}/.local" \
	"${USER_HOME}/.local/share/opencode" \
	"${USER_HOME}/.local/state/opencode"

cat > /usr/local/bin/opencode-fix-permissions <<EOF
#!/bin/bash
set -euo pipefail

for path in \
	"${USER_HOME}/.config" \
	"${USER_HOME}/.config/opencode" \
	"${USER_HOME}/.local" \
	"${USER_HOME}/.local/share" \
	"${USER_HOME}/.local/share/opencode" \
	"${USER_HOME}/.local/state" \
	"${USER_HOME}/.local/state/opencode"
do
	if [ -e "\$path" ] && [ "\$(stat -c '%U' "\$path" 2>/dev/null)" != "${USERNAME}" ]; then
		sudo chown ${USERNAME}:${USERNAME} "\$path" 2>/dev/null || true
	fi
done

for path in \
	"${USER_HOME}/.config/opencode" \
	"${USER_HOME}/.local/share/opencode" \
	"${USER_HOME}/.local/state/opencode"
do
	if [ -e "\$path" ]; then
		sudo chown -R ${USERNAME}:${USERNAME} "\$path" 2>/dev/null || true
	fi
done
EOF

chmod +x /usr/local/bin/opencode-fix-permissions

mkdir -p "$marker_dir"
touch "$marker_file"

poststart_script="$(dirname "$0")/postStartCommand.sh"
if [ -f "$poststart_script" ]; then
  cp "$poststart_script" "$marker_dir/opencode-postStartCommand.sh"
  chmod +x "$marker_dir/opencode-postStartCommand.sh"
fi

log "Instalação concluída"