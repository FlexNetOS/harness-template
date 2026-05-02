# Package: devcontainer-features

Publishable [Dev Container Features](https://containers.dev/implementors/features/)
authored in this monorepo.

## Layout

- `src/<feature>/devcontainer-feature.json` — feature metadata (id, version, options)
- `src/<feature>/install.sh` — POSIX-bash installer; must `set -euo pipefail` and be idempotent
- `src/<feature>/README.md` — usage example and options table
- `test/<feature>/test.sh` — smoke test using `dev-container-features-test-lib`
- `.github/workflows/` — release/test/validate pipelines (migrated from upstream)

## Features

| Feature             | Origin    | Description                                                                  |
| ------------------- | --------- | ---------------------------------------------------------------------------- |
| `claude-cli`        | new       | Installs `@anthropic-ai/claude-code` globally via npm.                       |
| `codex-cli`         | new       | Installs `@openai/codex` globally via npm.                                   |
| `gemini-cli`        | new       | Installs `@google/gemini-cli` globally; falls back to an `npx` wrapper.      |
| `sops-age`          | new       | Installs `sops` and `age` binaries with pinned SHA256 verification.          |
| `opencode`          | migrated  | opencode AI coding agent CLI + persistent-volume permission helper.          |
| `agency-agents`     | migrated  | (migrated verbatim — see `src/agency-agents/README.md`)                      |
| `agents-workspace`  | migrated  | (migrated verbatim — see `src/agents-workspace/README.md`)                   |

## Authoring rules

- `install.sh` must:
  - `set -euo pipefail`
  - be POSIX-bash, with no bashisms that break under busybox/alpine where avoidable
  - be idempotent (use a marker file under `/usr/local/share/devcontainer-features/`)
  - validate `version`-style inputs against an alnum/`._-` allowlist
  - prefer pinned-checksum downloads for binary releases
- `devcontainer-feature.json` must include `id`, `name`, `version`, `description`, `options`, `installsAfter`.
- `test/<feature>/test.sh` must source `dev-container-features-test-lib`, use `check`, and end with `reportResults`.

## Local validation

The `devcontainers/ci` action runs `devcontainer features test` over `src/` + `test/`.
Locally:

```bash
npx -y @devcontainers/cli features test --features <feature> --base-image mcr.microsoft.com/devcontainers/base:ubuntu .
```
