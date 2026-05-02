#!/usr/bin/env bash
# post-create.sh — runs once after the devcontainer is created.
#
# Template-specific responsibilities:
#   1. Decrypt .env.sops into the post-create shell (NEVER to disk).
#   2. Smoke-test the Claude CLI.
#   3. pnpm install.
#   4. Wait for Postgres, then run drizzle migrations.
#
# Idempotent — safe to re-run.

set -euo pipefail

bold()  { printf '\033[1m%s\033[0m\n' "$*"; }
info()  { printf '  %s\n' "$*"; }
warn()  { printf '\033[33m  WARN: %s\033[0m\n' "$*" >&2; }
ok()    { printf '\033[32m  OK:   %s\033[0m\n' "$*"; }
hr()    { printf '\n%s\n' "------------------------------------------------------------"; }

cd "$(dirname "$0")/.."

AGE_KEY_DIR="${HOME}/.config/sops/age"
AGE_KEY_FILE="${AGE_KEY_DIR}/keys.txt"

# ---------------------------------------------------------------------------
# 1. age key bootstrap
# ---------------------------------------------------------------------------
hr
bold "[1/5] Verifying age key for SOPS"
mkdir -p "${AGE_KEY_DIR}"
chmod 700 "${AGE_KEY_DIR}" || true
if [[ ! -s "${AGE_KEY_FILE}" ]]; then
    warn "No age key at ${AGE_KEY_FILE}. Generating one."
    age-keygen -o "${AGE_KEY_FILE}"
    chmod 600 "${AGE_KEY_FILE}"
    pubkey="$(grep -E '^# public key:' "${AGE_KEY_FILE}" | sed 's/^# public key: //')"
    bold "  Your age public key (add to .sops.yaml recipients):"
    printf '    %s\n' "${pubkey}"
else
    ok "age key present at ${AGE_KEY_FILE}"
fi

# ---------------------------------------------------------------------------
# 2. Decrypt .env.sops (in-memory only)
# ---------------------------------------------------------------------------
hr
bold "[2/5] Loading secrets from .env.sops (in-memory only)"
if [[ -f .env.sops ]]; then
    if decrypted="$(sops -d --output-type dotenv .env.sops 2>/dev/null)"; then
        # Parse line-by-line and export safely. `sed | eval` re-parses
        # comment lines as shell, which breaks on parens/backticks/etc.
        while IFS= read -r line; do
            case "$line" in
                ''|'#'*) continue ;;
                *=*)
                    key="${line%%=*}"
                    value="${line#*=}"
                    case "$key" in
                        ''|*[!A-Za-z0-9_]*) continue ;;
                    esac
                    export "$key=$value"
                    ;;
            esac
        done <<< "$decrypted"
        unset decrypted line key value
        ok ".env.sops decrypted into post-create environment"
        info "To load these in your interactive shell, add to ~/.bashrc:"
        info '  set -a; eval "$(sops -d --output-type dotenv $PWD/.env.sops 2>/dev/null)"; set +a'
    else
        warn "Failed to decrypt .env.sops — your age public key may not be in .sops.yaml."
    fi
else
    info "No .env.sops yet. Copy .env.example -> .env (dev only) or run 'sops .env.sops' to create one."
fi

# ---------------------------------------------------------------------------
# 3. Smoke-test Claude CLI
# ---------------------------------------------------------------------------
hr
bold "[3/5] Smoke-testing Claude CLI"
if claude --version >/dev/null 2>&1; then
    ok "claude: $(claude --version 2>&1 | head -n1)"
else
    warn "claude CLI not runnable. Set ANTHROPIC_API_KEY (via .env.sops) and re-test with 'claude --version'."
fi

# ---------------------------------------------------------------------------
# 4. pnpm install
# ---------------------------------------------------------------------------
hr
bold "[4/5] Installing dependencies (pnpm install)"
if [[ -f package.json ]]; then
    if pnpm install --frozen-lockfile 2>/dev/null; then
        ok "pnpm install (frozen lockfile)"
    else
        warn "Frozen-lockfile install failed (likely no lockfile yet). Falling back."
        pnpm install || warn "pnpm install failed — re-run manually."
    fi
else
    info "No package.json — skipping."
fi

# ---------------------------------------------------------------------------
# 5. Wait for Postgres + run migrations
# ---------------------------------------------------------------------------
hr
bold "[5/5] Waiting for Postgres + running migrations"

DB_HOST="${POSTGRES_HOST:-postgres}"
DB_PORT="${POSTGRES_PORT:-5432}"
DB_USER="${POSTGRES_USER:-postgres}"

attempt=0
max_attempts=30
until pg_isready -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" >/dev/null 2>&1; do
    attempt=$((attempt + 1))
    if (( attempt >= max_attempts )); then
        warn "Postgres not ready after ${max_attempts}s. Skipping migration. Run 'pnpm migrate' once it's up."
        break
    fi
    sleep 1
done

if pg_isready -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" >/dev/null 2>&1; then
    ok "Postgres is ready at ${DB_HOST}:${DB_PORT}"
    if [[ -f package.json ]] && pnpm migrate 2>/dev/null; then
        ok "drizzle migrations applied"
    else
        info "Skipping migrations (no script or DB not configured). Run 'pnpm migrate' manually."
    fi
fi

hr
ok "post-create complete"
