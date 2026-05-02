# @harness-template/project-spawner

The `harness-spawn` CLI scaffolds a new project from a stack template in the
`harness-template` monorepo. One command, one project, no vendoring.

## Quickstart

```bash
# Scaffold the "next-prisma" template into ./my-app, default = ship all 3 AI context files
npx harness-spawn next-prisma my-app

# Same thing but only ship CLAUDE.md (drops AGENTS.md and GEMINI.md)
npx harness-spawn next-prisma my-app --ai-cli=claude
```

## Install

This package ships from the harness-template workspace. From a checkout:

```bash
cd packages/project-spawner
npm install
npm link             # exposes `harness-spawn` on your PATH
```

After publishing, `npx harness-spawn ...` will work standalone.

## Usage

```text
harness-spawn <template-name> <project-name> [options]
```

### Arguments

| Arg              | Description                                                              |
| ---------------- | ------------------------------------------------------------------------ |
| `<template-name>`| A directory name under `templates/` (e.g. `next-prisma`, `python-fastapi`). |
| `<project-name>` | Target directory created under `cwd`. Must not already exist.            |

### Options

| Option         | Default | Description                                                                  |
| -------------- | ------- | ---------------------------------------------------------------------------- |
| `--ai-cli`     | `all`   | Which AI CLI context file(s) to keep: `claude`, `codex`, `gemini`, or `all`. |
| `--skip-age`   | `false` | Skip age-key resolution / generation. Useful in CI.                          |
| `-h, --help`   | -       | Print help.                                                                  |
| `-v, --version`| -       | Print version.                                                               |

### What it does

1. Validates that `templates/<template-name>/` exists.
2. Copies the template into `./<project-name>/` (skipping `node_modules`,
   `.git`, build dirs, etc.).
3. Filters per-CLI context files based on `--ai-cli`:
   - `claude` keeps `CLAUDE.md`
   - `codex` keeps `AGENTS.md`
   - `gemini` keeps `GEMINI.md`
   - `all` keeps all three
4. Initializes a fresh git repo (`git init -q`).
5. Looks up your age public key at `~/.config/sops/age/keys.txt`. If missing,
   runs `age-keygen` to generate one and prints the new public key.
6. Writes a `.env.sops` skeleton, encrypted to your age public key when both
   `sops` and a public key are available; otherwise drops a plaintext placeholder.
7. Prints "Open in container" instructions.

### Examples

```bash
# Generic three-AI scaffold
harness-spawn next-prisma blog

# Only ship Claude Code context
harness-spawn next-prisma blog --ai-cli=claude

# CI-friendly (no age key prompt)
harness-spawn next-prisma blog --ai-cli=codex --skip-age
```

### Environment

| Variable                   | Effect                                                |
| -------------------------- | ----------------------------------------------------- |
| `HARNESS_TEMPLATES_ROOT`   | Override the templates directory (useful for tests).  |

## Development

```bash
# Run the test suite (Node test runner)
npm test

# Run the CLI from source
node src/cli.js next-prisma my-app
```

### Project layout

```
packages/project-spawner/
  src/
    cli.js            # CLI entry + public API
    index.js          # programmatic re-export
  tests/
    cli.test.js       # node --test
    fixtures/
      templates/
        sample-stack/ # tiny fixture template
  package.json
  README.md
  CLAUDE.md
```

## Contributing

- Cross-platform: paths via `path.join` only. No backslash literals.
- Node >= 20.
- Public functions must have a paired test in `tests/`.
- File naming: lowercase with hyphens.

## License

MIT
