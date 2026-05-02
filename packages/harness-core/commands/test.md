---
description: Verify phase — fan out per-package test sub-agents, run the matrix, and report pass/fail plus coverage. Modes for TDD, E2E, and integration testing.
argument-hint: "[--mode=tdd|e2e|integration|standard] [<unit glob>]"
---

# /test — Verify (Spine Phase 5 of 7)

`/test` is the **fifth phase of the seven-phase spine**:

```
/think → /plan → /code → /review → [/test] → /ship → /reflect
```

It is the **verify** step. Every package's test suite runs, plus mode-specific sub-agents (TDD test-writers, E2E orchestrators, integration harness runners). Output is a per-package pass/fail matrix plus a coverage summary; coordinator computes the ship-readiness verdict.

This phase **subsumes both `tdd` and `e2e`** — they become modes (`--mode=tdd`, `--mode=e2e`) on `/test`. Existing references to the legacy commands continue to work via alias.

---

## Inputs

- `$ARGUMENTS` — optional package glob (e.g. `packages/harness-core`) to restrict scope. Default: every workspace package.
- Required-when-relevant flags:
  - `--mode=standard` (default) — run existing test suites.
  - `--mode=tdd` — TDD workflow: failing tests first, then implementation, then green tests. Used when no tests exist yet for the target.
  - `--mode=e2e` — end-to-end mode: spin up dependencies (Docker, browsers via Playwright/Puppeteer), run integration scenarios.
  - `--mode=integration` — cross-package integration tests; spawns one test sub-agent per integration boundary in the workspace graph.
- Optional flags:
  - `--coverage=on|off` — toggle coverage collection (default `on`).
  - `--bail-on-first-fail` — stop the matrix on first red package (default off; surface all failures).
  - `--retry-flaky=N` — re-run failing tests up to N times to surface flake-vs-deterministic (default 0).

## Outputs

- Per-package pass/fail matrix in chat (rows: package, columns: status, duration, coverage).
- Coverage summary: workspace-rolled-up percent + per-package breakdown.
- A persisted report at `~/.claude/test-runs/<slug>-<timestamp>.md`.
- A ship-readiness verdict: `ALL-GREEN`, `GREEN-WITH-FLAKES`, or `RED`.

## How it composes

- Runs after `/code` (or in parallel with `/review`).
- Hands off to `/ship` only when verdict is `ALL-GREEN`. `/ship` will refuse to dispatch if the most recent `/test` was not green for the same diff.
- Loops back to `/code` if `RED`; the report names which package and which test failed.
- Auxiliaries available inside this phase: gstack per-language test commands (`python-test`, `cpp-test`, `go-test`, etc.) are auto-selected by package language.

## Subsumed legacy commands

| Legacy | Status |
|---|---|
| agent_harness `tdd` | Subsumed as `--mode=tdd` |
| agent_harness `e2e` | Subsumed as `--mode=e2e` |
| gstack per-language test commands | Retained as auxiliaries; auto-invoked by package language |

---

## Fan-out shape

**One sub-agent per package** (or per integration boundary in `--mode=integration`):

| Sub-agent | Role | Specialist source |
|---|---|---|
| `test-runner-<pkg>` (×N) | Run the package's test suite, collect coverage, retry flakes per `--retry-flaky` | `packages/harness-core/agents/test-runner.md` |
| `tdd-author-<pkg>` (×N, mode=tdd only) | Write failing tests against the plan's contract before implementation runs | `packages/harness-core/agents/tdd-author.md` |
| `e2e-orchestrator` (singleton, mode=e2e only) | Spin up dependencies (Docker compose, browsers), run integration scenarios | `packages/harness-core/agents/e2e-orchestrator.md` |

Coordinator synthesis rule: **matrix-with-flake-detection**. Coordinator collects per-package results, classifies any failure as `deterministic` or `flake` based on `--retry-flaky` results, computes coverage rollup, and emits the verdict. A single deterministic fail anywhere → `RED`. Flakes only → `GREEN-WITH-FLAKES` (ship-allowed but flagged).

---

## Implementation (thin wrapper over `tools/spine-fanout.js`)

```bash
node tools/spine-fanout.js \
  --phase=test \
  --units="${ARGUMENTS:-auto}" \
  --mode="${MODE:-standard}" \
  --coverage="${COVERAGE:-on}" \
  --retry-flaky="${RETRY_FLAKY:-0}" \
  --specialists-by-mode \
  --synthesis=matrix-with-flake-detection \
  --output-report="$HOME/.claude/test-runs/${SLUG}-$(date +%Y%m%d-%H%M%S).md"
```

The dispatcher is responsible for:
1. Resolving package set from `$ARGUMENTS` or the workspace graph.
2. Selecting specialist set per `--mode`.
3. Spawning N test-runner sub-agents in parallel (with concurrency cap to avoid CPU/disk thrash).
4. For `--mode=e2e`, the singleton orchestrator runs first (dependency spin-up), then per-package tests.
5. Running `matrix-with-flake-detection` synthesis.
6. Writing the report and printing the matrix to chat.

---

## Authoring guidance

When the user invokes `/test`:

1. Determine mode. If unclear, default to `standard` and say so.
2. Run the dispatcher exactly as above.
3. Lead the chat summary with the verdict, then the per-package matrix, then the coverage summary.
4. If `RED`, list each deterministic failure with package, test name, and the first 5–10 lines of the failure output. Do **not** summarize away the failure — show it.
5. If `GREEN-WITH-FLAKES`, name the flaky tests by package — flakes are tech debt and `/reflect` should harvest them.

Do **not** declare `ALL-GREEN` if even one test is skipped without explicit reason in the test file. Skipped-without-reason → flake. Boil-the-Ocean: **never quietly tolerate red**.
