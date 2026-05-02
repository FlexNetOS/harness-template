---
description: Design phase — write a plan inline by default; WAIT for user CONFIRM before touching any code. Optionally fan out design alternatives via --fan-out.
argument-hint: "<feature, problem, or selected /think direction>"
---

# /plan — Design (Spine Phase 2 of 7)

> **Safety contract (preserved from agent_harness's `/plan`):**
>
> - Do not call the Task tool or any subagent by default. `/plan` runs inline by default; the plan is produced by the calling Claude turn and written to disk before yielding.
> - If the `planner` subagent is unavailable (because a downstream consumer has not installed it), the inline path is the canonical fallback.
> - The fan-out behavior described below is opt-in via `--fan-out` and only spawns the `planner` subagent when explicitly requested.
> - WAIT for user CONFIRM before touching any code. `/plan` will **NOT** write any code until you explicitly confirm the plan, regardless of which path runs.
>
> Example handoff banner the command MUST emit before yielding:
>
> ```
> [/plan] WAITING FOR CONFIRMATION — review the plan at ~/.claude/plans/<slug>.md
> ```

`/plan` is the **second phase of the seven-phase spine**:

```
/think → [/plan] → /code → /review → /test → /ship → /reflect
```

It is the **converge after diverge** step. `/think` widened the option space; `/plan` narrows it to a single, executable design with explicit risks. The plan is a written artifact — not vibes — saved at `~/.claude/plans/<slug>.md` and consumed verbatim by `/code`.

This phase **subsumes agent_harness's existing `/plan`** command — its plan-mode rigor (clarifying-questions ladder, file-by-file change list, risk register) is preserved here, and any project that referenced the legacy command continues to work via alias.

---

## Inputs

- `$ARGUMENTS` — feature description, problem statement, or a `/think` direction (in which case the dispatcher reads the matching `~/.claude/notes/think/<slug>.md`).
- Optional flags:
  - `--from-think=<slug>` — explicit pointer to the `/think` note to consume.
  - `--depth=quick|standard|deep` — affects design-alternative breadth (default `standard` = 3 alts).
  - `--alternatives=N` — override default of 3 design-alternative sub-agents.
  - `--no-risk` — skip risk-mapper (rare; not recommended).
  - `--out=<path>` — override default plan path.

## Outputs

- A plan file at `~/.claude/plans/<slug>.md` containing:
  - Context (one paragraph, what is being built and why)
  - Chosen design (one of the three alternatives, with rationale)
  - Rejected alternatives (one paragraph each, why not)
  - File-by-file change list (path → what changes)
  - Risk register (rows: risk, likelihood, blast radius, mitigation)
  - Verification ladder (numbered checks that must pass before declaring done)
  - Open questions (with sane defaults; non-blocking)
- A short summary in chat with the plan path and a one-line "ready for `/code`" or "needs more `/think`" verdict.

## How it composes

- Consumes `/think` output via `--from-think` or fresh prose.
- Hands off to `/code`, which loads the plan file as its primary input and produces matching code + tests + docs.
- May loop back to `/think` if the design space turns out to be wider than the input assumed — coordinator will say so explicitly.
- Auxiliary inside this phase: agents-workspace `/aw:delegate` for spawning a single deep-dive sub-agent on a particularly thorny sub-problem.

## Subsumed legacy commands

| Legacy | Status |
|---|---|
| agent_harness `/plan` | Subsumed (alias) — full plan-mode rigor preserved here |
| agents-workspace `/aw:delegate` | Retained as auxiliary callable from within this phase |

---

## Fan-out shape

Four sub-agents run **in parallel**, plus a coordinator synthesizes:

| Sub-agent | Role | Specialist source |
|---|---|---|
| `design-alt-A` | Conservative design — minimum change, reuse existing primitives | `packages/harness-core/agents/conservative-designer.md` |
| `design-alt-B` | Idiomatic design — what a senior engineer in the codebase's prevailing style would do | `packages/harness-core/agents/idiomatic-designer.md` |
| `design-alt-C` | Ambitious design — willing to refactor for the right shape, names the cost | `packages/harness-core/agents/ambitious-designer.md` |
| `risk-mapper` | Independent of the alternatives, surfaces failure modes, ops risks, blast-radius across all three | `packages/harness-core/agents/risk-mapper.md` |

Coordinator synthesis rule: **pick-one-with-receipts**. Coordinator picks exactly one alternative — never a Frankenstein hybrid — and writes the plan file. The two rejected alternatives appear in the file with a one-paragraph justification each (so the trail is auditable when `/reflect` revisits the decision later). The risk register from `risk-mapper` is merged in verbatim.

---

## Implementation (thin wrapper over `tools/spine-fanout.js`)

```bash
node tools/spine-fanout.js \
  --phase=plan \
  --input="$ARGUMENTS" \
  --seed-from-think="${FROM_THINK:-auto}" \
  --specialists=design-alt-A,design-alt-B,design-alt-C,risk-mapper \
  --synthesis=pick-one-with-receipts \
  --output-plan="$HOME/.claude/plans/${SLUG}.md"
```

The dispatcher is responsible for:
1. Resolving `--from-think` (or auto-detecting the most recent matching `/think` note).
2. Spawning all four specialists in parallel with the seed.
3. Awaiting them with a per-agent timeout (deep design takes longer — default 6 min).
4. Running `pick-one-with-receipts` synthesis against the four returns.
5. Writing the plan file and printing its path to chat.

If `risk-mapper` fails, the dispatcher does **not** silently produce a plan without a risk register — it surfaces the failure and asks whether to retry or proceed without (`--no-risk` is the explicit way to do this; never silent).

---

## Authoring guidance

When the user invokes `/plan`:

1. **Clarifying-questions ladder** — if `$ARGUMENTS` is ambiguous, ask 1–3 focused questions before dispatching. Never ask more than 3; if more are needed, the input is wide enough to need `/think` first.
2. Run the dispatcher exactly as above.
3. Present the chosen plan with the file path and a one-line handoff: "Ready for `/code` — plan at `<path>`."
4. If the risk register includes a `blast_radius=large` row, **explicitly call it out** in chat before handing off, even if the user is rushing.

Do **not** start writing code inside `/plan`. The plan is the artifact; code is the next phase. If the user pushes for code, point at `/code`.
