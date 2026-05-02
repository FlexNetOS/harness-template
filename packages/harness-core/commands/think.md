---
description: Divergent ideation — fan out three perspectives in parallel and synthesize a top-3 directions list with strongest-and-why reasoning.
argument-hint: "<problem statement or open question>"
---

# /think — Divergent Ideation (Spine Phase 1 of 7)

`/think` is the **first phase of the seven-phase spine**:

```
[/think] → /plan → /code → /review → /test → /ship → /reflect
```

It is the **diverge** step. The goal is not to pick an answer — it is to widen the option space before `/plan` narrows it. `/think` is invoked when the user has a problem, an opportunity, or an open question and needs structured exploration *before* committing to a design.

---

## Inputs

- `$ARGUMENTS` — the problem statement, opportunity, or open question. Required.
- Optional flags (parsed by `tools/spine-fanout.js`):
  - `--depth=quick|standard|deep` — sub-agent token budget. Default `standard`.
  - `--seed=<file>` — pass an existing brief, transcript, or research note into every sub-agent.
  - `--no-devil` — skip the devil's-advocate sub-agent (rare; default keeps it).

## Outputs

- A `## Top 3 Directions` markdown block in chat, each direction including:
  - One-line framing
  - Strongest argument (why it might win)
  - Strongest counter (why it might fail)
  - Confidence (`low|medium|high`)
  - Suggested next phase (`/plan`, more `/think`, or stop)
- A timestamped session note appended to `~/.claude/notes/think/<slug>.md` for `/reflect` to harvest later.

## How it composes

- Hands off to `/plan` with the chosen direction; `/plan` consumes the same `<slug>.md` note as input.
- Can be re-entered (loop) if no direction crosses the confidence threshold — coordinator will explicitly say "rerun `/think` with narrower scope" rather than fake confidence.
- Auxiliaries available inside this phase: `/aw:wiki` (look up prior art), `/brainstorm` (single-perspective expansion of one direction).

## Subsumed legacy commands

| Legacy | Status |
|---|---|
| `/brainstorm` | Retained as auxiliary; `/think` calls it as one of the fan-out specialists |
| agents-workspace `/aw:wiki` | Retained as auxiliary; invoked from within problem-frame sub-agent |

Nothing is dropped — `/think` is the **coordinator**, not a replacement.

---

## Fan-out shape

Three sub-agents run **in parallel**, plus a coordinator merges:

| Sub-agent | Role | Specialist source |
|---|---|---|
| `problem-frame` | Restate the problem from first principles, surface hidden assumptions, name the constraints | `packages/harness-core/agents/problem-framer.md` |
| `opportunity-scan` | Generate 5–8 directions wider than the user posed, including off-the-wall ones | `packages/harness-core/agents/opportunity-scanner.md` |
| `devils-advocate` | For every promising direction, produce the strongest reason it fails | `packages/harness-core/agents/devils-advocate.md` |

Coordinator synthesis rule: **rank-then-cull**. Coordinator collects all directions across the three sub-agents, deduplicates by semantic similarity, scores each on (impact × tractability × novelty), and surfaces the top 3 with the devil's-advocate critique attached. Confidence is high only when at least two of three sub-agents independently surfaced the direction.

---

## Implementation (thin wrapper over `tools/spine-fanout.js`)

This command body is intentionally a thin coordinator. The real fan-out logic lives in `tools/spine-fanout.js` — that is the single source of truth for parallel dispatch across the entire spine.

```bash
node tools/spine-fanout.js \
  --phase=think \
  --input="$ARGUMENTS" \
  --specialists=problem-frame,opportunity-scan,devils-advocate \
  --synthesis=rank-then-cull \
  --output-note="$HOME/.claude/notes/think/$(date +%Y%m%d-%H%M%S)-${SLUG:-untitled}.md"
```

The dispatcher is responsible for:
1. Spawning each specialist sub-agent with a clean context window and the `--seed` (if provided).
2. Awaiting all in parallel with a per-agent timeout.
3. Passing the structured returns into the `rank-then-cull` synthesis routine.
4. Writing the session note for `/reflect`.
5. Returning the final markdown block to chat.

If any single sub-agent fails, the dispatcher continues with the survivors and flags the gap in the output — degraded but not blocked.

---

## Authoring guidance

When the user invokes `/think`:

1. Restate their question back in your own words to confirm framing — one sentence, then proceed.
2. Run the dispatcher exactly as above. Do not improvise the fan-out by spawning agents inline; that bypasses the contract.
3. Present the top 3 directions in the prescribed shape.
4. End with one explicit recommendation: "I'd take direction #N to `/plan` because …" — never punt the choice back to the user without a recommendation.

Do **not** make implementation decisions inside `/think`. That belongs to `/plan`. If you find yourself sketching code or files, stop and tell the user "this is a `/plan` step."
