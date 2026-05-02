# CLAUDE.md - @harness-template/project-spawner

Short context for Claude Code when working inside this package.

## What this package is

The `harness-spawn` CLI. Given a stack name and a project name, it copies
`templates/<stack-name>/` into a new project directory, sets up git, age/sops,
and per-AI-CLI context files.

## Layout

- `src/cli.js` - CLI entry point. Also exports a programmatic `run({ ... })`
  function that tests use directly without spawning a subprocess.
- `src/index.js` - re-export shim.
- `tests/cli.test.js` - `node --test` suite.
- `tests/fixtures/templates/sample-stack/` - tiny template used in tests.

## Conventions

- CommonJS (`require` / `module.exports`). No TypeScript, no ESM.
- Node >= 20.
- Cross-platform: always use `path.join` / `path.resolve` and `fs/promises`.
- `spawnSync` calls use `shell: process.platform === 'win32'` so `git`,
  `age-keygen`, and `sops` resolve correctly on Windows.
- Every public function in `src/cli.js` has a paired test.

## Key invariants

1. `harness-spawn` (no args) prints help and exits 0.
2. Missing template -> exit code 2 with clear error.
3. Existing target directory -> exit code 3 (no overwrite).
4. `--ai-cli=claude|codex|gemini` keeps exactly one context file; `all`
   keeps all three.
5. `.env.sops` is always written (encrypted if `sops` + age key available,
   plaintext placeholder otherwise).
6. age key generation is best-effort; failures degrade to plaintext skeleton,
   never crash the scaffold.

## Don't do

- Don't shell out to `npm install` from this package - the user runs that.
- Don't write outside the new project directory (other than `~/.config/sops/age/keys.txt`
  when generating an age key, which is intentional).
- Don't add heavy dependencies. `cac`, `chalk`, and `ora` are the budget.
