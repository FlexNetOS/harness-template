# `@harness-template/devcontainer-features`

Publishable [Dev Container Features](https://containers.dev/implementors/features/)
that ship the harness-template AI tooling stack into any devcontainer.

After release, features are pulled by OCI ref:
`ghcr.io/<owner>/devcontainer-features/<feature>:<version>`.

## Features in this package

| Feature             | Status   | Summary                                                                |
| ------------------- | -------- | ---------------------------------------------------------------------- |
| `claude-cli`        | new      | `@anthropic-ai/claude-code` via npm.                                   |
| `codex-cli`         | new      | `@openai/codex` via npm.                                               |
| `gemini-cli`        | new      | `@google/gemini-cli` via npm with npx fallback wrapper.                |
| `sops-age`          | new      | `sops` + `age` binaries, SHA256-pinned.                                |
| `opencode`          | migrated | opencode CLI + volume-permission helper + auto-update postStartCommand.|
| `agency-agents`     | migrated | (see `src/agency-agents/README.md`)                                    |
| `agents-workspace`  | migrated | (see `src/agents-workspace/README.md`)                                 |

## Compose all four new features in a downstream `devcontainer.json`

```jsonc
{
  "name": "my-ai-workbench",
  "image": "mcr.microsoft.com/devcontainers/base:ubuntu",
  "features": {
    "ghcr.io/devcontainers/features/common-utils:2": {},
    "ghcr.io/devcontainers/features/node:1": { "version": "lts" },

    "ghcr.io/<owner>/devcontainer-features/claude-cli:0":  { "version": "latest" },
    "ghcr.io/<owner>/devcontainer-features/codex-cli:0":   { "version": "latest" },
    "ghcr.io/<owner>/devcontainer-features/gemini-cli:0":  { "version": "latest" },
    "ghcr.io/<owner>/devcontainer-features/sops-age:0":    {
      "sopsVersion": "3.9.4",
      "ageVersion":  "1.2.1"
    }
  }
}
```

Replace `<owner>` with the GitHub org/user that publishes the OCI artifacts.

## Per-feature docs

Each feature has its own `README.md` under `src/<feature>/` with the full
options table and a usage snippet.

## Verify a built container

```bash
claude --version
codex --version
gemini --version
sops --version
age --version
```

## Testing

Per-feature shell tests live in `test/<feature>/test.sh` and run via the
`devcontainers/ci` GitHub Action — see `.github/workflows/test.yaml`.

To run a single feature's test locally:

```bash
npx -y @devcontainers/cli features test \
  --features sops-age \
  --base-image mcr.microsoft.com/devcontainers/base:ubuntu \
  .
```

## Releasing

`.github/workflows/release.yaml` publishes each feature as an OCI artifact
under `ghcr.io/<owner>/devcontainer-features/<feature>` when changes land on
the default branch. Bump the `version` field in
`src/<feature>/devcontainer-feature.json` to cut a new release of that feature.
