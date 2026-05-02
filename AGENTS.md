# AGENTS.md — harness-template (root)

This file is the canonical specialist-first agent policy for the repository.
It is loaded by AI CLIs that follow the AGENTS.md convention (Codex, OpenCode, etc.)
and supplements the per-CLI files (CLAUDE.md, GEMINI.md, etc.).

## Specialist-first workflow

When a task arrives:

1. **Identify the phase** on the slash-command spine (`/think /plan /code /review
   /test /ship /reflect`).
2. **Identify the right specialists** for that phase. See
   `packages/skills-foundation/AGENTS.md` for the full delegation matrix.
3. **Dispatch in parallel** via `tools/spine-fanout.js`. Do not chain serial calls
   when the work decomposes into independent units.
4. **Coordinator merges** specialist outputs into a single coherent result.

## When NOT to delegate

- Trivial tasks (typo fixes, single-line renames, one-shot lookups).
- Tasks with hard cross-specialist dependencies — fan-out only when units are independent.
- When the user explicitly says "do it yourself."

## Per-package overrides

Each package may carry its own `AGENTS.md` that extends or overrides this root file.
Most notably, `packages/skills-foundation/AGENTS.md` (folded in from the original
agents-workspace) carries the full specialist-first ruleset and 144+ specialist
agent definitions.
