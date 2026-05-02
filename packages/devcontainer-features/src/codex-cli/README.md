# OpenAI Codex CLI (`codex-cli`)

Installs the [OpenAI Codex CLI](https://github.com/openai/codex)
(`@openai/codex`) globally via npm.

## Example usage

```jsonc
{
  "features": {
    "ghcr.io/devcontainers/features/node:1": {},
    "ghcr.io/<owner>/devcontainer-features/codex-cli:0": {
      "version": "latest"
    }
  }
}
```

## Options

| Option    | Type   | Default  | Description                                                  |
| --------- | ------ | -------- | ------------------------------------------------------------ |
| `version` | string | `latest` | npm dist-tag or semver of `@openai/codex` to install.        |

## Notes

- Requires `node` and `npm` on `PATH`. Pair with `ghcr.io/devcontainers/features/node`
  for predictable Node versioning.
- Installation is idempotent per-`version` via a marker file.

## Verify

```bash
codex --version
```
