#!/usr/bin/env bash
# post-create.sh — runs once after the devcontainer is created.
#
# Responsibilities:
#   1. Ensure the user has an age private key for SOPS decryption.
#   2. Decrypt .env.sops into the CURRENT shell environment only (never to
#      disk). Skip gracefully if the file does not exist yet (first clone
#      before the maintainer has populated secrets).
#   3. Run `pnpm install` for the workspace.
#   4. Smoke-test each AI CLI; never fail post-create on a smoke-test miss.
#   5. Print clear, per-CLI auth instructions.
#
# This script is intentionally idempotent — re-running it is safe.

set -euo pipefail

# --- Pretty output helpers --------------------------------------------------
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
bold "[1/5] Checking age key for SOPS decryption"

mkdir -p "${AGE_KEY_DIR}"
chmod 700 "${AGE_KEY_DIR}" || true

if [[ ! -s "${AGE_KEY_FILE}" ]]; then
    warn "No age key found at ${AGE_KEY_FILE}."
    info "Generating a fresh age key. BACK THIS UP — losing it means losing"
    info "access to every secret encrypted with the matching public key."
    age-keygen -o "${AGE_KEY_FILE}"
    chmod 600 "${AGE_KEY_FILE}"

    pubkey="$(grep -E '^# public key:' "${AGE_KEY_FILE}" | sed 's/^# public key: //')"
    info ""
    bold "  Your age public key (give this to the maintainer to add to .sops.yaml):"
    printf '    %s\n' "${pubkey}"
    info ""
    info "  Backup steps:"
    info "    1) Copy ${AGE_KEY_FILE} to a password manager (1Password / Bitwarden / etc.)."
    info "    2) On host, mirror it to ~/.config/sops/age/keys.txt so it persists across rebuilds."
    info "    3) Never commit it. Never paste it in chat."
else
    ok "age key present at ${AGE_KEY_FILE}"
fi

# ---------------------------------------------------------------------------
# 2. Decrypt .env.sops into current shell (in-memory only)
# ---------------------------------------------------------------------------
hr
bold "[2/5] Loading secrets from .env.sops (in-memory only)"

if [[ -f .env.sops ]]; then
    # Decrypt to dotenv format and export each key. We do NOT write a .env
    # file — secrets live only in the current shell's environment.
    #
    # NOTE: post-create runs in its own bash process, so vars exported here
    # do NOT bleed into the user's interactive shell. The actual export-on-
    # shell-start lives in shell rc files (out of scope for this script);
    # here we just verify decryption works and surface env to the rest of
    # this post-create run (notably `pnpm install`, which may need them).
    if decrypted="$(sops -d --output-type dotenv .env.sops 2>/dev/null)"; then
        # shellcheck disable=SC2046
        eval "$(printf '%s\n' "${decrypted}" | sed 's/^/export /')"
        unset decrypted
        ok ".env.sops decrypted into post-create environment"
        info "Note: to load these into your interactive shell, add this to ~/.bashrc:"
        info "  eval \"\$(sops -d --output-type dotenv /workspaces/harness-template/.env.sops 2>/dev/null | sed 's/^/export /')\""
    else
        warn "Failed to decrypt .env.sops. Common causes:"
        info "  - Your age public key is not listed in .sops.yaml recipients."
        info "  - The age key file (${AGE_KEY_FILE}) is for a different identity."
        info "  - The file is malformed."
        info "Continuing without decrypted secrets."
    fi
else
    info "No .env.sops in the workspace yet — skipping decryption."
    info "(This is normal on first clone before the maintainer has populated secrets.)"
fi

# ---------------------------------------------------------------------------
# 3. pnpm install
# ---------------------------------------------------------------------------
hr
bold "[3/5] Installing workspace dependencies (pnpm install)"

if [[ -f pnpm-workspace.yaml || -f package.json ]]; then
    if pnpm install --frozen-lockfile 2>/dev/null; then
        ok "pnpm install (frozen lockfile)"
    else
        warn "Frozen-lockfile install failed (likely no lockfile yet). Falling back to a normal install."
        pnpm install || warn "pnpm install failed — fix and re-run 'pnpm install' manually."
    fi
else
    info "No package.json or pnpm-workspace.yaml at workspace root — skipping pnpm install."
fi

# ---------------------------------------------------------------------------
# 4. Smoke-test each CLI
# ---------------------------------------------------------------------------
hr
bold "[4/5] Smoke-testing AI CLIs"

smoke_test() {
    local name="$1"; shift
    if "$@" >/dev/null 2>&1; then
        ok "${name}: $("$@" 2>&1 | head -n1)"
    else
        warn "${name}: not runnable. See auth instructions below."
    fi
}

smoke_test "claude" claude --version || true
smoke_test "codex"  codex  --version || true
smoke_test "gemini" gemini --version || true
smoke_test "gh"     gh     --version || true

# ---------------------------------------------------------------------------
# 5. Per-CLI auth instructions
# ---------------------------------------------------------------------------
hr
bold "[5/5] Authentication instructions"
cat <<'EOF'

  Each AI CLI authenticates differently. We deliberately do NOT auto-auth —
  credentials should land in your shell from .env.sops or via the CLI's own
  login flow, never baked into the image.

  ──────────────────────────────────────────────────────────────────────────
  Claude Code  (Anthropic)
  ──────────────────────────────────────────────────────────────────────────
    Set the env var (preferred via .env.sops):
      ANTHROPIC_API_KEY=sk-ant-...
    Verify:
      claude --version
      claude   # interactive

  ──────────────────────────────────────────────────────────────────────────
  Codex CLI  (OpenAI)
  ──────────────────────────────────────────────────────────────────────────
    Run the device-code login (recommended — no key in env):
      codex login
    Or set:
      OPENAI_API_KEY=sk-...
    Verify:
      codex --version

  ──────────────────────────────────────────────────────────────────────────
  Gemini CLI  (Google)
  ──────────────────────────────────────────────────────────────────────────
    Either set:
      GOOGLE_API_KEY=...
    Or run an interactive login:
      gemini auth         # if your CLI build supports it
    If 'gemini' is not on PATH, the npm install above failed — fall back to:
      npx https://github.com/google-gemini/gemini-cli --version
    Verify:
      gemini --version

  ──────────────────────────────────────────────────────────────────────────
  GitHub CLI  (gh)
  ──────────────────────────────────────────────────────────────────────────
    Run the device-code login (recommended):
      gh auth login
    Or set a Personal Access Token (CI / headless):
      GH_TOKEN=ghp_...   # or GITHUB_TOKEN
    Verify:
      gh --version
      gh auth status

  ──────────────────────────────────────────────────────────────────────────
  Loading secrets into your interactive shell
  ──────────────────────────────────────────────────────────────────────────
    Append to ~/.bashrc (one-time):
      if [ -f /workspaces/harness-template/.env.sops ]; then
        eval "$(sops -d --output-type dotenv /workspaces/harness-template/.env.sops 2>/dev/null | sed 's/^/export /')"
      fi
    Then 'source ~/.bashrc' (or open a new terminal).

EOF

hr
ok "post-create complete"
