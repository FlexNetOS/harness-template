# tools/

Cross-cutting Node utilities used by the harness hooks, CI workflows, and
spine commands. Everything here is CommonJS (Node >=20) and depends only on
the Node standard library.

## Layout

| File                            | Caller                          | Role                                                                |
| ------------------------------- | ------------------------------- | ------------------------------------------------------------------- |
| `boil-review.js`                | PreToolUse hook (quick), CI (full) | "Boil-the-ocean" 10-section review derived from `garrys-mega-plan.md`. |
| `spine-fanout.js`               | All 7 spine commands            | Dispatch primitive: fans a phase out to specialists, merges results. |
| `host-detect.js`                | Hooks, skills, install scripts  | Detects which AI CLI is driving the harness (Claude/Codex/Gemini/...).|
| `check-command-collisions.js`   | CI                              | Enforces phase-ownership matrix across packages.                    |
| `install.sh` / `install.ps1`    | End users                       | Outside-container installer for `sops`, `age`, optional CLIs.       |
| `tests/*.test.js`               | `node --test`                   | Unit tests for each utility.                                        |

## Running tests

```bash
node --test tools/tests
```

All tests use the built-in `node:test` runner — no additional dependencies.

## Required dependencies

None today. Every utility is built on Node >=20 stdlib (`fs`, `path`,
`child_process`, `os`). A header comment in each file declares the deps so a
follow-up can lift them into the root `package.json` if/when this changes.
**Do not** edit the root `package.json` from this directory without going
through the agent that owns it.

---

## `boil-review.js`

Two modes:

- `--quick` — emits the 10-section checklist as injectable context for
  Claude. Intended for the PreToolUse hook. Fast (<200ms), no diff parsing.
- `--full` — diff-driven heuristic sweep. Default diff source is
  `git diff --staged`; pass `--diff-file PATH` to override. Each of the 10
  sections is currently a starter implementation with clearly-marked TODOs.

Output: `--json` for structured JSON, otherwise structured Markdown.

Exit codes: `0` clean, `1` warnings, `2` critical (CI-blocking).

```bash
# Hook usage (injects context for the next turn):
node tools/boil-review.js --quick

# CI usage:
node tools/boil-review.js --full --json > /tmp/report.json
```

The 10 sections (in order): Architecture, Errors & Rescue Map, Security &
Threat Model, Data Flow & Interaction Edge Cases, Code Quality, Tests,
Performance, Observability, Deployment, Long-Term Trajectory. The text comes
straight from `garrys-mega-plan.md`.

---

## `spine-fanout.js`

```js
const { dispatch } = require('./spine-fanout');

const merged = await dispatch({
  phase: 'review',
  specialists: [
    { id: 'security', brief: '<self-contained brief>' },
    { id: 'perf',     brief: '<self-contained brief>' },
  ],
  synthesis: 'Coordinator: prefer block-on-block findings.',
  context: { repoRoot, diffFile },
  // optional `runner`: explicit Task-tool runner (used by spine commands
  // running inside Claude Code).
});
```

Runtime:

1. If a `runner` is provided, it is used directly.
2. Otherwise, if the process appears to be running under Claude Code's Task
   tool (env var heuristic) and no runner is provided, `dispatch` throws —
   silent fallback would be wrong.
3. Otherwise: parallel `claude -p ... --output-format json` subprocesses.
4. If `claude` isn't on PATH: a stub runner emits placeholder findings so
   the rest of the pipeline still wires up.

Merge rules:

- `findings` — union, deduplicated by `<specialist>::<title>`.
- `verdict`  — max severity (`pass` < `warn` < `block`).
- `suggestions` — deduplicated by case-insensitive trimmed text.
- Per-specialist failures are isolated into `errors[]`; one specialist
  blowing up does not poison the rest.

---

## `host-detect.js`

```js
const { detect } = require('./host-detect');
const { host, confidence, signals } = detect();
// → { host: 'claude', confidence: 0.85, signals: [...] }
```

Detects: `claude`, `codex`, `gemini`, `cursor`, `factory`, `aider`,
`continue`, or `unknown`. Heuristics combine env vars (heaviest), parent
process name, and filesystem markers in cwd (`CLAUDE.md`, `AGENTS.md`,
`GEMINI.md`, `.cursor/`, `.factory/`, etc.).

Designed to be safe to call from blocking PreToolUse hooks — no shell-out
to a child detector beyond a single best-effort `ps`/`wmic` for the parent
process name. Confidence is capped at `0.99`; `'unknown'` has confidence `0`.

CLI usage prints JSON:

```bash
node tools/host-detect.js
```

---

## `check-command-collisions.js`

Enforces the phase-ownership matrix:

- Spine command names — `think`, `plan`, `code`, `review`, `test`, `ship`,
  `reflect` — may only be defined in `packages/harness-core/commands/`.
- The `aw:` command/skill namespace is reserved for
  `packages/skills-foundation/`.

Scans `packages/*/commands/*.md` and `packages/skills-*/skills/*/SKILL.md`,
honoring `name:` frontmatter overrides.

```bash
node tools/check-command-collisions.js          # text report
node tools/check-command-collisions.js --json   # structured
node tools/check-command-collisions.js --root /path/to/repo
```

Exit `0` on clean tree, `1` on any violation.

---

## `install.sh` / `install.ps1`

Outside-container installer for users who want to use individual harness
pieces without the devcontainer. Idempotent — re-running is safe. Detects
the platform and uses `brew`, `apt`, `dnf`, `pacman`, `apk`, `scoop`,
`choco`, or `winget` as appropriate. Installs `sops` and `age` by default.

Pass `--with-cli` (bash) or `-WithCli` (PowerShell) to also attempt
installation of `claude`, `codex`, and `gemini` CLIs where the platform's
package manager has formulae for them.

```bash
tools/install.sh
tools/install.sh --with-cli
tools/install.sh --dry-run --with-cli

# PowerShell
./tools/install.ps1
./tools/install.ps1 -WithCli
./tools/install.ps1 -DryRun
```
