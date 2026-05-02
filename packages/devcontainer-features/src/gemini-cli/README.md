# Google Gemini CLI (`gemini-cli`)

Installs the [Google Gemini CLI](https://github.com/google-gemini/gemini-cli)
globally via npm (`@google/gemini-cli`).

If the npm package is unavailable at install time, the feature writes a wrapper
script to `/usr/local/bin/gemini` that exec's the upstream directly via:

```bash
npx --yes https://github.com/google-gemini/gemini-cli "$@"
```

so users get a working `gemini` command either way.

## Example usage

```jsonc
{
  "features": {
    "ghcr.io/devcontainers/features/node:1": {},
    "ghcr.io/<owner>/devcontainer-features/gemini-cli:0": {
      "version": "latest"
    }
  }
}
```

## Options

| Option    | Type   | Default  | Description                                                                       |
| --------- | ------ | -------- | --------------------------------------------------------------------------------- |
| `version` | string | `latest` | npm dist-tag/semver of `@google/gemini-cli`. Ignored when the npx fallback runs.  |

## Notes

- Requires `node` and `npm` on `PATH`.
- The first invocation of the npx-fallback wrapper will fetch and cache the CLI;
  subsequent invocations are fast.
- Installation is idempotent per-`version` via a marker file.

## Verify

```bash
gemini --version
```
