# GitHub CLI (gh) — devcontainer feature

Installs the official `gh` CLI from `cli.github.com`'s apt repository.

## Usage

```jsonc
{
  "features": {
    "ghcr.io/FlexNetOS/harness-template/github-cli:1": {
      "version": "latest"
    }
  }
}
```

## Options

| Option    | Type   | Default  | Description                                                              |
| --------- | ------ | -------- | ------------------------------------------------------------------------ |
| `version` | string | `latest` | gh version. `latest` follows whatever the apt repo currently publishes.  |

## Auth

This feature **does not** authenticate gh — credentials never go into image layers. Authenticate at runtime, once per host, via:

```bash
gh auth login        # interactive device-code flow
# OR
export GH_TOKEN=ghp_xxx   # for CI / headless contexts
```

`~/.config/gh` is typically mounted from the host into the container, so a single login on your laptop covers every container.

## Cross-references

- [docs/CLI-AUTH.md](../../../docs/CLI-AUTH.md) — full auth flow
- [docs/SPAWNER.md](../../../docs/SPAWNER.md) — `harness-spawn` uses gh for repo creation
- gh manual: https://cli.github.com/manual/

## Compatible base images

Tested against `mcr.microsoft.com/devcontainers/javascript-node` and `mcr.microsoft.com/devcontainers/base:bookworm`. Should work on any Debian/Ubuntu derivative with apt and curl.
