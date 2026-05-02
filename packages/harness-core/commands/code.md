---
description: Implementation phase — fan out N implementation sub-agents (one per package or feature unit) and ship code + tests + docs in the same change.
argument-hint: "<plan slug or path to ~/.claude/plans/*.md>"
---

# /code — Implementation (Spine Phase 3 of 7)

`/code` is the **third phase of the seven-phase spine**:

```
/think → /plan → [/code] → /review → /test → /ship → /reflect
```

It is the **build** step. `/plan` produced an executable design; `/code` executes it across N packages or feature units in parallel and returns code, tests, and docs in **the same change** — never code without tests, never code without docs.

The Boil-the-Ocean completeness standard applies in full: ship the finished product on turn 1. Workarounds, "tabled for later", and dangling threads are explicitly disallowed. The root `CLAUDE.md` injection makes this universal — `/code` does not need to repeat it.

---

## Inputs

- `$ARGUMENTS` — plan slug (looks up `~/.claude/plans/<slug>.md`) or absolute path to a plan file. Required.
- Optional flags:
  - `--units=<glob>` — restrict implementation to specific packages (e.g. `--units=packages/harness-core,packages/skills-foundation`). Default: every package the plan's file-by-file change list touches.
  - `--max-parallel=N` — cap concurrent sub-agents (default 6, hard ceiling 12).
  - `--mode=tdd` — invokes test-first sub-agents that write failing tests before implementation; the dispatcher passes `--mode=tdd` through to each unit. (See also `/test --mode=tdd` for after-the-fact TDD on existing code.)
  - `--dry-run` — produce diffs but do not write files (useful for review-before-write workflows).

## Outputs

- File writes / edits across the touched packages — code, tests, and docs in one coherent change.
- A summary in chat: per-unit (added/changed/removed line counts, test files added, doc updates).
- Automatic handoff suggestion to `/review`.

## How it composes

- Reads the plan file produced by `/plan`. Treats it as the contract — does not invent new files outside the file-by-file list without explicit user approval.
- Hands off to `/review` (critique) and `/test` (verify), in either order or in parallel.
- Loops back to `/plan` if the implementation reveals the design is wrong — coordinator will explicitly recommend this rather than fudge the plan in-place.
- Auxiliaries available inside this phase:
  - `/skill-create` — when a reusable pattern emerges, a sub-agent can call this to mint a new skill in the appropriate package (`packages/skills-software-factory/` or `packages/skills-domain/`).
  - agents-workspace `/aw:implement` — alternative single-agent implementation when fan-out is overkill.

## Subsumed legacy commands

| Legacy | Status |
|---|---|
| agent_harness `/skill-create` | Subsumed as a **utility** invoked from within `/code` when a reusable pattern is detected; still callable directly for explicit skill authoring |
| agents-workspace `/aw:implement` | Retained as auxiliary; useful for trivial single-file changes where fan-out adds overhead |
| `/tdd` | Subsumed as `--mode=tdd` flag on `/code` (and on `/test`) |

---

## Fan-out shape

**N sub-agents in parallel — one per package or feature unit** named in the plan's file-by-file list:

| Sub-agent | Role | Specialist source |
|---|---|---|
| `impl-<unit>` (×N) | Implement the plan's changes for one package; write tests; update docs | `packages/harness-core/agents/implementation-engineer.md` |
| `cross-cutting-checker` | Single coordinator-side pass after units finish: ensure interfaces match across packages, no orphaned exports | inline in `tools/spine-fanout.js` |

Coordinator synthesis rule: **merge-and-cross-check**. Each unit returns a structured diff. Coordinator (a) writes diffs to disk in dependency order, (b) runs the cross-cutting checker over the combined result, (c) if any contract mismatch is found, dispatches a fix-up sub-agent for the offending unit and repeats. The phase only declares success when all units report green and cross-cutting check is clean.

The Boil-the-Ocean completeness standard is enforced inside each sub-agent's brief: every implementation sub-agent ships code + tests + docs together — refusing to return until all three exist.

---

## Implementation (thin wrapper over `tools/spine-fanout.js`)

```bash
node tools/spine-fanout.js \
  --phase=code \
  --plan="$PLAN_PATH" \
  --units="${UNITS:-auto}" \
  --max-parallel="${MAX_PARALLEL:-6}" \
  --mode="${MODE:-standard}" \
  --synthesis=merge-and-cross-check
```

The dispatcher is responsible for:
1. Loading the plan file and parsing its file-by-file change list into a unit graph.
2. Topologically sorting units by dependency edges (from package.json workspaces + import graph).
3. Spawning up to `--max-parallel` sub-agents simultaneously, respecting dependencies.
4. Each sub-agent receives: (a) the slice of the plan relevant to its unit, (b) the package's `CLAUDE.md` context, (c) any rules the package opts into.
5. After all units finish, the cross-cutting checker validates interface contracts.
6. If `--dry-run`, diffs are returned to chat and **no files are written**.

---

## Authoring guidance

When the user invokes `/code`:

1. Confirm the plan path. If the plan is missing or stale, redirect to `/plan`.
2. Run the dispatcher exactly as above.
3. After it returns, summarize per-unit changes and recommend the next phase: usually "run `/review` and `/test` in parallel."
4. If any unit's implementation revealed a design flaw, **say so out loud** — do not paper over it. Recommend a `/plan` loop.

Do **not** declare success without the cross-cutting check. Do **not** ship code without matching tests and doc updates. The completeness standard is enforced; degrade loudly, never silently.
