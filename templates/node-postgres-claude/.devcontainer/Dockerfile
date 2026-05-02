# syntax=docker/dockerfile:1.6
#
# DevContainer image for the node-postgres-claude reference template.
#
# Layered on the published harness-template features for sops/age + Claude CLI.
# After first publish, switch :latest -> :1 (pinned major).
# TODO(after-first-publish): replace `:latest` with `:1` for reproducibility.

FROM mcr.microsoft.com/devcontainers/javascript-node:1-20-bookworm

# ---------------------------------------------------------------------------
# OS plumbing
# ---------------------------------------------------------------------------
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        ca-certificates \
        curl \
        git \
        gnupg \
        jq \
        postgresql-client \
    && rm -rf /var/lib/apt/lists/*

# ---------------------------------------------------------------------------
# sops + age — pinned. (When the harness-template GHCR features are published,
# replace these RUN blocks with `COPY --from=ghcr.io/FlexNetOS/harness-template/sops-age:latest /usr/local/bin /usr/local/bin`.)
# ---------------------------------------------------------------------------
ARG SOPS_VERSION=3.9.1
RUN set -eux; \
    arch="$(dpkg --print-architecture)"; \
    case "$arch" in \
        amd64) url="https://github.com/getsops/sops/releases/download/v${SOPS_VERSION}/sops-v${SOPS_VERSION}.linux.amd64" ;; \
        arm64) url="https://github.com/getsops/sops/releases/download/v${SOPS_VERSION}/sops-v${SOPS_VERSION}.linux.arm64" ;; \
        *) echo "unsupported arch: $arch" >&2; exit 1 ;; \
    esac; \
    curl -fsSL -o /tmp/sops "$url"; \
    install -m 0755 /tmp/sops /usr/local/bin/sops; \
    rm -f /tmp/sops; \
    sops --version

ARG AGE_VERSION=1.2.0
RUN set -eux; \
    arch="$(dpkg --print-architecture)"; \
    case "$arch" in \
        amd64) url="https://github.com/FiloSottile/age/releases/download/v${AGE_VERSION}/age-v${AGE_VERSION}-linux-amd64.tar.gz" ;; \
        arm64) url="https://github.com/FiloSottile/age/releases/download/v${AGE_VERSION}/age-v${AGE_VERSION}-linux-arm64.tar.gz" ;; \
        *) echo "unsupported arch: $arch" >&2; exit 1 ;; \
    esac; \
    curl -fsSL -o /tmp/age.tgz "$url"; \
    tar -xzf /tmp/age.tgz -C /tmp; \
    install -m 0755 /tmp/age/age /usr/local/bin/age; \
    install -m 0755 /tmp/age/age-keygen /usr/local/bin/age-keygen; \
    rm -rf /tmp/age /tmp/age.tgz; \
    age --version

# ---------------------------------------------------------------------------
# pnpm + Claude CLI
# ---------------------------------------------------------------------------
# TODO(after-first-publish): replace the pnpm + Claude install with
#   COPY --from=ghcr.io/FlexNetOS/harness-template/claude-cli:latest /usr/local/lib/node_modules /usr/local/lib/node_modules
#   COPY --from=ghcr.io/FlexNetOS/harness-template/claude-cli:latest /usr/local/bin/claude /usr/local/bin/claude
RUN npm install -g pnpm@9.12.0 \
    && pnpm --version

RUN npm install -g @anthropic-ai/claude-code \
    || echo "WARN: @anthropic-ai/claude-code install failed; CLI unavailable until manual install."

# ---------------------------------------------------------------------------
# Workspace + permissions
# ---------------------------------------------------------------------------
RUN mkdir -p /workspaces/node-postgres-claude /home/node/.config/sops/age \
    && chown -R node:node /home/node /workspaces/node-postgres-claude

USER node
WORKDIR /workspaces/node-postgres-claude
