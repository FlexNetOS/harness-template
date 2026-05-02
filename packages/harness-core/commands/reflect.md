---
description: Learn phase — fan out a session-transcript skill-extractor and a retro-summarizer; distill learnings to ~/.claude/memory/ and optionally mint a new skill.
argument-hint: "[<session id, date range, or 'last-cycle'>]"
---

# /reflect — Learn (Spine Phase 7 of 7)

`/reflect` is the **seventh and final phase of the seven-phase spine**:

```
/think → /plan → /code → /review → /test → /ship → [/reflect]
```

It is the **learn** step — the one most teams skip. After a feature ships, `/reflect` mines the session transcripts, the plan, the review report, the test results, and the shipping log to extract reusable lessons. Output goes to `~/.claude/memory/` so future sessions inherit the learnings, and optionally mints a new skill for genuinely repeatable patterns.

This phase **subsumes agent_harness's `/learn`** command — the pattern-extraction workflow is preserved here as one of the two parallel sub-agents.

---

## Inputs

- `$ARGUMENTS` — optional session selector. One of:
  - `last-cycle` (default) — the most recent `/think → /ship` arc.
  - `<session-id>` — a specific Claude Code session identifier.
  - `<YYYY-MM-DD>..<YYYY-MM-DD>` — a date range.
  - `<plan-slug>` — reflect on the cycle that produced this plan.
- Optional flags:
  - `--mint-skill=auto|always|never` — whether to mint a new skill from extracted patterns. Default `auto` (mint only when a pattern crosses confidence threshold and isn't already a skill).
  - `--target-memory=<path>` — override default `~/.claude/memory/` location.
  - `--retro-format=tldr|standard|deep` — depth of retro narrative.

## Outputs

- One or more memory entries appended to `~/.claude/memory/<topic>.md` in the project's auto-memory directory.
- Optionally, a new skill scaffolded into `~/.claude/skills/<skill-name>/SKILL.md` (per the project's skill-placement policy: generated/imported skills go under `~/.claude/skills/`, not the curated `skills/` tree).
- A retro summary in chat with: what worked, what didn't, what to change, what's now codified.
- A persisted retro at `~/.claude/retros/<slug>-<timestamp>.md`.

## How it composes

- Runs after `/ship` (default) — closes the loop on a delivery cycle.
- Can run standalone on any past session (no shipping required) — useful after exploratory `/think` sessions or after fixing a production incident.
- Hands off back to the next iteration's `/think` with extracted learnings as the seed.
- Auxiliary inside this phase: `/skill-create` is invoked when `--mint-skill` triggers.

## Subsumed legacy commands

| Legacy | Status |
|---|---|
| agent_harness `/learn` | Subsumed and merged with gstack's reflect — its session-transcript pattern-extraction is the `skill-extractor` sub-agent |
| agent_harness `/skill-create` | Retained as auxiliary; auto-invoked when a pattern earns minting |

---

## Fan-out shape

**Two sub-agents in parallel**, plus a coordinator merges:

| Sub-agent | Role | Specialist source |
|---|---|---|
| `skill-extractor` | Mine the session transcripts for reusable patterns: prompts that worked, sub-agent compositions that succeeded, gotchas avoided. Score each pattern on (frequency, generality, concreteness) | `packages/harness-core/agents/skill-extractor.md` |
| `retro-summarizer` | Read the plan, review, test report, and ship log; produce a what-worked / what-didn't / what-to-change retro | `packages/harness-core/agents/retro-summarizer.md` |

Coordinator synthesis rule: **distill-then-mint**. Coordinator collects the patterns and the retro, deduplicates against existing memory entries (so we don't keep re-learning the same thing), writes new memory entries, and consults `--mint-skill` to decide whether to scaffold a new skill. Confidence threshold for auto-mint: pattern observed in ≥3 sessions and not already covered by an existing skill.

---

## Implementation (thin wrapper over `tools/spine-fanout.js`)

```bash
node tools/spine-fanout.js \
  --phase=reflect \
  --session="${ARGUMENTS:-last-cycle}" \
  --specialists=skill-extractor,retro-summarizer \
  --synthesis=distill-then-mint \
  --mint-skill="${MINT_SKILL:-auto}" \
  --target-memory="${TARGET_MEMORY:-$HOME/.claude/memory/}" \
  --output-retro="$HOME/.claude/retros/${SLUG}-$(date +%Y%m%d-%H%M%S).md"
```

The dispatcher is responsible for:
1. Resolving the session selector to a concrete set of transcripts + reports + ship logs.
2. Spawning the two specialists in parallel with the resolved corpus.
3. Running `distill-then-mint` synthesis — including dedupe against existing memory.
4. Writing memory entries (append, never clobber).
5. Optionally minting a new skill via the `/skill-create` utility.
6. Writing the retro report and printing the chat summary.

---

## Authoring guidance

When the user invokes `/reflect`:

1. Default to `last-cycle` if no argument given. Confirm what range you're reflecting over before dispatching.
2. Run the dispatcher exactly as above.
3. Lead the chat summary with: (a) the 1–3 most important learnings, (b) any new memory entries by path, (c) any minted skill by path.
4. If a skill was minted, **invite review** — automatic minting is a draft, not a commitment.
5. Recommend the next `/think` if a new opportunity surfaced during the retro.

Do **not** invent learnings to fill space. If the cycle was uneventful, say so. The memory directory is read on every future session — pollution is permanent.

---

## A note on the spine loop

`/reflect` is not the end. It feeds the next `/think`. Treating the spine as a one-shot pipeline misses the point — the loop is what compounds. Every cycle's retro becomes the next cycle's seed.
