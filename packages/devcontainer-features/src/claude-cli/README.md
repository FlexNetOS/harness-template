# Claude Code CLI (`claude-cli`)

Installs the Anthropic [Claude Code](https://docs.anthropic.com/en/docs/claude-code)
CLI globally via npm (`@anthropic-ai/claude-code`).

## Example usage

```jsonc
{
  "features": {
    "ghcr.io/devcontainers/features/node:1": {},
    "ghcr.io/<owner>/devcontainer-features/claude-cli:0": {
      "version": "latest"
    }
  }
}
```

## Options

| Option    | Type   | Default  | Description                                                                 |
| --------- | ------ | -------- | --------------------------------------------------------------------------- |
| `version` | string | `latest` | npm dist-tag or semver of `@anthropic-ai/claude-code` to install.           |

## Notes

- Requires `node` and `npm` on `PATH`. If absent, the feature attempts a distro
  install of Node.js LTS, but pairing it with
  `ghcr.io/devcontainers/features/node` is recommended.
- Installation is idempotent per-`version` via a marker file under
  `/usr/local/share/devcontainer-features/`.

## Verify

```bash
claude --version
```
