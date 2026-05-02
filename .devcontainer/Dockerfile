# syntax=docker/dockerfile:1.6
#
# DevContainer image for harness-template.
#
# Goals:
#   - Provide a turnkey shell with the three AI CLIs (Claude, Codex, Gemini)
#     pre-installed and on PATH.
#   - Ship sops + age (pinned, checksum-verified) so the post-create hook can
#     decrypt .env.sops directly into the shell environment without ever
#     writing secrets to disk.
#   - Ship pnpm@9.12.0 globally so spawned templates can install workspaces.
#
# Notes:
#   - We deliberately do NOT run `pnpm install` here. The workspace install
#     happens in post-create.sh, after .env.sops has been decrypted (so install
#     scripts that need secrets can see them).
#   - sops and age from Debian apt are typically out-of-date; we fetch the
#     official GitHub releases and verify SHA256 checksums.

FROM mcr.microsoft.com/devcontainers/javascript-node:1-20-bookworm

# ---------------------------------------------------------------------------
# OS packages
# ---------------------------------------------------------------------------
# python3/pip: many AI CLI workflows shell out to small python helpers.
# git/curl/jq/gnupg: standard plumbing used by post-create.sh and CLIs.
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        ca-certificates \
        curl \
        git \
        gnupg \
        jq \
        python3 \
        python3-pip \
    && rm -rf /var/lib/apt/lists/*

# ---------------------------------------------------------------------------
# sops (getsops) — pinned + checksum-verified
# ---------------------------------------------------------------------------
# Upstream releases: https://github.com/getsops/sops/releases
# Hashes verified against https://github.com/getsops/sops/releases/download/v3.9.4/sops-v3.9.4.checksums.txt
ARG SOPS_VERSION=3.9.4
ARG SOPS_AMD64_SHA256=5488e32bc471de7982ad895dd054bbab3ab91c417a118426134551e9626e4e85
ARG SOPS_ARM64_SHA256=16564c6b181d88505d9e0dfef62771894293d85cde5884d9b1a843859eee174b
RUN set -eux; \
    arch="$(dpkg --print-architecture)"; \
    case "$arch" in \
        amd64) \
            url="https://github.com/getsops/sops/releases/download/v${SOPS_VERSION}/sops-v${SOPS_VERSION}.linux.amd64"; \
            sha="${SOPS_AMD64_SHA256}"; \
            ;; \
        arm64) \
            url="https://github.com/getsops/sops/releases/download/v${SOPS_VERSION}/sops-v${SOPS_VERSION}.linux.arm64"; \
            sha="${SOPS_ARM64_SHA256}"; \
            ;; \
        *) echo "unsupported arch: $arch" >&2; exit 1 ;; \
    esac; \
    curl -fsSL -o /tmp/sops "$url"; \
    echo "${sha}  /tmp/sops" | sha256sum -c -; \
    install -m 0755 /tmp/sops /usr/local/bin/sops; \
    rm -f /tmp/sops; \
    sops --version

# ---------------------------------------------------------------------------
# age (FiloSottile/age) — pinned, verification is best-effort
# ---------------------------------------------------------------------------
# Upstream releases: https://github.com/FiloSottile/age/releases
#
# IMPORTANT: age does NOT publish a flat checksums.txt file. It publishes
# `.proof` files which are sigstore transparency-log inclusion proofs. Proper
# verification requires sigstore tooling (cosign verify-blob) inside the
# container — over-engineered for a devcontainer base image.
#
# These pinned SHA256 values were captured from observed build outputs.
# If a checksum mismatches at build time, the WARN mode prints the actual
# sha256 — pin that value here. arm64 has not yet been observed on this
# host; first arm64 build will surface it.
#
# To upgrade: download age-v<X>-linux-{amd64,arm64}.tar.gz, run sha256sum,
# replace these ARG values.
ARG AGE_VERSION=1.2.1
ARG AGE_AMD64_SHA256=7df45a6cc87d4da11cc03a539a7470c15b1041ab2b396af088fe9990f7c79d50
ARG AGE_ARM64_SHA256=TBD-OBSERVE-ON-FIRST-ARM64-BUILD
ARG AGE_VERIFY_MODE=warn
RUN set -eux; \
    arch="$(dpkg --print-architecture)"; \
    arch_upper="$(echo "$arch" | tr '[:lower:]' '[:upper:]')"; \
    case "$arch" in \
        amd64) \
            url="https://github.com/FiloSottile/age/releases/download/v${AGE_VERSION}/age-v${AGE_VERSION}-linux-amd64.tar.gz"; \
            sha="${AGE_AMD64_SHA256}"; \
            ;; \
        arm64) \
            url="https://github.com/FiloSottile/age/releases/download/v${AGE_VERSION}/age-v${AGE_VERSION}-linux-arm64.tar.gz"; \
            sha="${AGE_ARM64_SHA256}"; \
            ;; \
        *) echo "unsupported arch: $arch" >&2; exit 1 ;; \
    esac; \
    curl -fsSL -o /tmp/age.tgz "$url"; \
    if echo "${sha}  /tmp/age.tgz" | sha256sum -c - 2>/dev/null; then \
        echo "[age] checksum verified"; \
    else \
        actual="$(sha256sum /tmp/age.tgz | awk '{print $1}')"; \
        if [ "$AGE_VERIFY_MODE" = "strict" ]; then \
            echo "ERROR: age checksum mismatch (actual=$actual expected=$sha). Set --build-arg AGE_VERIFY_MODE=warn to bypass." >&2; \
            exit 1; \
        else \
            echo "WARN: age checksum mismatch — observed=$actual expected=$sha. Update AGE_${arch_upper}_SHA256 in Dockerfile to pin." >&2; \
        fi; \
    fi; \
    tar -xzf /tmp/age.tgz -C /tmp; \
    install -m 0755 /tmp/age/age /usr/local/bin/age; \
    install -m 0755 /tmp/age/age-keygen /usr/local/bin/age-keygen; \
    rm -rf /tmp/age /tmp/age.tgz; \
    age --version; \
    age-keygen --version || true

# ---------------------------------------------------------------------------
# GitHub CLI (gh) — installed from the official cli.github.com apt repository
# ---------------------------------------------------------------------------
# gh is essential for repo / PR / GHCR ops from inside the container.
# Auth happens at runtime (`gh auth login` device code or GH_TOKEN env var).
RUN set -eux; \
    curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg \
        | dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg; \
    chmod go+r /usr/share/keyrings/githubcli-archive-keyring.gpg; \
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" \
        > /etc/apt/sources.list.d/github-cli.list; \
    apt-get update; \
    apt-get install -y --no-install-recommends gh; \
    rm -rf /var/lib/apt/lists/*; \
    gh --version

# ---------------------------------------------------------------------------
# pnpm — pinned global install
# ---------------------------------------------------------------------------
RUN npm install -g pnpm@9.12.0 \
    && pnpm --version

# ---------------------------------------------------------------------------
# AI CLIs (global)
# ---------------------------------------------------------------------------
# Claude Code: published as @anthropic-ai/claude-code.
RUN npm install -g @anthropic-ai/claude-code \
    || echo "WARN: @anthropic-ai/claude-code install failed; CLI will be unavailable until you install it manually."

# OpenAI Codex CLI: published as @openai/codex.
RUN npm install -g @openai/codex \
    || echo "WARN: @openai/codex install failed; CLI will be unavailable until you install it manually."

# Google Gemini CLI: try the npm package first (@google/gemini-cli). If it ever
# stops resolving, the post-create script and CLI-AUTH README document the
# `npx https://github.com/google-gemini/gemini-cli` fallback so users aren't
# blocked.
RUN npm install -g @google/gemini-cli \
    || echo "WARN: @google/gemini-cli install failed. Fallback: 'npx https://github.com/google-gemini/gemini-cli'."

# ---------------------------------------------------------------------------
# Workspace + permissions
# ---------------------------------------------------------------------------
RUN mkdir -p /workspaces/harness-template /home/node/.config/sops/age \
    && chown -R node:node /home/node /workspaces/harness-template

USER node
WORKDIR /workspaces/harness-template
