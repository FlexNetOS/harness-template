# `harness-spawn` — the project spawner

> The CLI that turns this template repo into a fresh, fully-equipped
> project on your disk. For why the spawner exists and how it fits into
> the overall design, see [ARCHITECTURE.md](./ARCHITECTURE.md).

## Install

`harness-spawn` ships from `packages/project-spawner`. The easiest way
to use it is via `npx` against a published release:

```bash
npx -y @harness/spawn@latest --template reference --name my-project
```

For local development of the template repo itself:

```bash
pnpm install
pnpm --filter @harness/project-spawner build
node packages/project-spawner/dist/cli.js --help
```

## Quick start

```bash
harness-spawn \
  --template reference \
  --name acme-billing \
  --out ./acme-billing
```

That command:

1. Loads the `reference` template manifest from `templates/reference/`.
2. Prompts you for any variables not provided as flags.
3. Renders every `*.ejs` file with your answers and copies everything else verbatim.
4. Copies the prompt library slice the template requested.
5. Initializes a git repo and makes the first commit.

## Flags

| Flag                  | Type     | Default     | Description                                                                       |
| --------------------- | -------- | ----------- | --------------------------------------------------------------------------------- |
| `--template <id>`     | string   | (required)  | Template id under `templates/`. Run with no args to see the list.                 |
| `--name <project>`    | string   | (required)  | Project name. Used in `package.json`, container labels, and README.               |
| `--out <dir>`         | path     | `./<name>`  | Where to write the spawned project.                                               |
| `--non-interactive`   | flag     | `false`     | Fail instead of prompting if any required variable is missing.                    |
| `--var <key=value>`   | repeated | (none)      | Pre-fill template variables. Repeatable. Example: `--var python_version=3.12`.   |
| `--no-git`            | flag     | `false`     | Skip `git init` and the initial commit.                                           |
| `--no-install`        | flag     | `false`     | Skip the post-spawn `pnpm install` step.                                          |
| `--features <a,b,c>`  | csv      | (template)  | Override the template's default Dev Container Features list.                      |
| `--clis <a,b,c>`      | csv      | `claude`    | Which AI CLI configs to copy in. Choices: `claude`, `codex`, `gemini`.            |
| `--dry-run`           | flag     | `false`     | Print the action plan without writing anything.                                   |
| `--verbose`           | flag     | `false`     | Show every file copy and substitution.                                            |
| `--version`           | flag     |             | Print spawner version and exit.                                                   |
| `--help`              | flag     |             | Print this help.                                                                  |

## How templates work

A template is a directory under `templates/` with two files at its root:

```
templates/<id>/
├── manifest.json      ← required
├── README.md          ← shown in `harness-spawn --list`
└── tree/              ← the actual files copied (with EJS rendering)
```

`manifest.json` declares the template's variables, defaults, prompt
library slice, and feature list:

```json
{
  "id": "reference",
  "title": "Reference TypeScript service",
  "description": "Plain TS service with the full harness installed.",
  "variables": [
    { "name": "node_version", "default": "20", "prompt": "Node major version?" },
    { "name": "license", "default": "MIT" }
  ],
  "features": [
    "ghcr.io/harness/devcontainer-features/pnpm:1",
    "ghcr.io/harness/devcontainer-features/sops-age:1"
  ],
  "promptLibrary": {
    "skills": ["coding-standards", "tdd-workflow"],
    "agents": ["planner", "code-reviewer"]
  }
}
```

Anything inside `tree/` ending in `.ejs` is rendered with [EJS](https://ejs.co/),
with the variable answers as the context object. Everything else is copied byte-for-byte.

## Adding a new template

1. `mkdir templates/my-stack && cd templates/my-stack`
2. Write a minimal `manifest.json` (see above).
3. Build out `tree/` with whatever files belong in the spawned project.
4. Use `<%= node_version %>` (etc.) inside `.ejs` files for any value
   that should be variable.
5. Add a `README.md` describing the template.
6. Add an end-to-end test under `packages/project-spawner/test/` that
   spawns it and runs `pnpm verify` against the output. (CI runs this
   via [`.github/workflows/e2e.yml`](../.github/workflows/e2e.yml).)
7. Commit. The boil-review engine will fail your PR if you forgot
   the README or the test.

## Troubleshooting

**"Template `<id>` not found."**
Run `harness-spawn --list` (no args) to see what's installed. If you're
working from a local checkout, make sure your CWD is the template repo
root or pass `--templates-dir <path>`.

**"Template variable `X` is required."**
Either pass `--var X=value` or drop `--non-interactive` so the CLI can prompt you.

**`pnpm install` fails inside the spawned project.**
Re-run with `--no-install` and inspect the generated `package.json` and
`pnpm-lock.yaml`. The most common cause is a template whose lockfile is
out of date with its `package.json` — fix it in `templates/<id>/tree/`
and re-spawn.

**The devcontainer fails to build.**
The spawner does not build the container; it just writes the
`.devcontainer/` directory. Build with:

```bash
devcontainer build --workspace-folder <out-dir> --image-name spawn-debug
```

If a feature reference 404s, the feature hasn't been published yet — see
[`.github/workflows/publish-features.yml`](../.github/workflows/publish-features.yml).

**Git init complains about user.email.**
Either configure git globally or pass `--no-git` and commit yourself.

## Cross-references

- Repo design: [ARCHITECTURE.md](./ARCHITECTURE.md)
- Review engine the spawned project inherits: [BOIL-THE-OCEAN.md](./BOIL-THE-OCEAN.md)
- Multi-agent runtime in spawned projects: [MULTI-CLAUDE.md](./MULTI-CLAUDE.md)
- Secrets in spawned projects: [VAULT.md](./VAULT.md)
- AI CLI auth in spawned projects: [CLI-AUTH.md](./CLI-AUTH.md)
- Top-level README: [../README.md](../README.md)
