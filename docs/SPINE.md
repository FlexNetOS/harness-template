# SPINE — The Slash-Command Pipeline

> The harness is a pipeline. Each phase is a slash command. Each command is a multi-agent fan-out. Skills, agents, hooks, and rules hang off the spine; they do not replace it.

This document is the architectural source of truth for the seven-phase spine. If a behavior contradicts what's written here, the spine wins; update the implementation, not the doc.

---

## 1. The pipeline at a glance

```
┌─────────┐   ┌─────────┐   ┌─────────┐   ┌─────────┐   ┌─────────┐   ┌─────────┐   ┌──────────┐
│ /think  │──▶│ /plan   │──▶│ /code   │──▶│ /review │──▶│ /test   │──▶│ /ship   │──▶│ /reflect │
└─────────┘   └─────────┘   └─────────┘   └─────────┘   └─────────┘   └─────────┘   └──────────┘
   ↑              ↑              ↑              ↑              ↑              ↑              │
   │              │              │              │              │              │              │
  diverge       design         build         critique       verify        deliver         learn
   │                                                                                         │
   └─────────────────────────────────────────────────────────────────────────────────────────┘
                              the loop: /reflect feeds the next /think
```

Each phase has:
- **One responsibility.** No phase doubles up. `/code` does not review; `/review` does not test; `/test` does not ship.
- **Explicit inputs and outputs.** A phase consumes the artifact of the previous phase and produces an artifact for the next. Artifacts are files on disk — not vibes.
- **A multi-agent fan-out.** Every phase dispatches specialist sub-agents in parallel via `tools/spine-fanout.js` and merges their output with a phase-specific synthesis rule.

---

## 2. Phase-by-phase contract

| Phase | Command | Input | Output | Specialists (fan-out) | Synthesis rule |
|---|---|---|---|---|---|
| 1. Diverge | `/think` | Problem statement / open question | Top-3 directions + session note in `~/.claude/notes/think/` | problem-frame, opportunity-scan, devils-advocate | rank-then-cull |
| 2. Design | `/plan` | `/think` direction or fresh prose | Plan file at `~/.claude/plans/<slug>.md` | design-alt-A, design-alt-B, design-alt-C, risk-mapper | pick-one-with-receipts |
| 3. Build | `/code` | Plan file | Code + tests + docs in same change | impl-<unit> ×N + cross-cutting-checker | merge-and-cross-check |
| 4. Critique | `/review` | Diff (PR / branch / staged) | Severity-ranked report at `~/.claude/reviews/` | security, performance, tests, architecture (+ language-specific auto-attached) | dedupe-and-rank-by-severity (+ Boil quick sweep) |
| 5. Verify | `/test` | Workspace or unit glob | Pass/fail matrix + coverage at `~/.claude/test-runs/` | test-runner-<pkg> ×N (+ tdd-author, e2e-orchestrator per mode) | matrix-with-flake-detection |
| 6. Deliver | `/ship` | Green review + green test | Tag + release + GHCR publish + ship log | build-runner, ci-dispatcher, ghcr-publisher, release-notes-drafter (+ build-fixer auto-spawn) | gate-on-build-then-publish |
| 7. Learn | `/reflect` | Session corpus | Memory entries + optional minted skill + retro at `~/.claude/retros/` | skill-extractor, retro-summarizer | distill-then-mint |

### Artifact paths (the spine's filesystem contract)

```
~/.claude/notes/think/<slug>.md            # /think  output → /plan input
~/.claude/plans/<slug>.md                  # /plan   output → /code input
~/.claude/reviews/<slug>-<ts>.md           # /review output → /ship precondition
~/.claude/test-runs/<slug>-<ts>.md         # /test   output → /ship precondition
~/.claude/ships/<version>-<ts>.md          # /ship   output → /reflect input
~/.claude/retros/<slug>-<ts>.md            # /reflect output → next /think seed
```

Files are append-only history. The spine never mutates a prior phase's artifact in-place — looping back means writing a new artifact with a new timestamp. This makes the trail auditable.

---

## 3. The fan-out primitive (`tools/spine-fanout.js`)

Every spine command is a **thin wrapper** that calls `tools/spine-fanout.js`. The dispatcher is the single source of truth for parallel sub-agent execution. It handles:

- **Spawn:** Creates N sub-agent contexts via the Claude Agent SDK's `Task` primitive (or, headlessly, via a Node-side worker pool dispatching `claude -p`).
- **Concurrency:** Honors a per-phase max-parallel cap; default 6, hard ceiling 12.
- **Briefing:** Each sub-agent gets a clean context window + a structured brief built from the phase config + the user's input.
- **Awaiting:** Per-agent timeout; survivors continue if one fails (degraded but not blocked).
- **Synthesis:** Calls the named synthesis routine (`rank-then-cull`, `pick-one-with-receipts`, etc.) on the structured returns.
- **Persistence:** Writes the phase's artifact to its canonical filesystem path.
- **Reporting:** Returns the chat summary to the calling command.

Phases pass parameters via flags:

```
--phase=<name>
--specialists=<comma-separated specialist ids>
--synthesis=<rule name>
--input=<user args>
--seed-from-<prev-phase>=<auto|path>
--output-<artifact-type>=<path>
--max-parallel=<N>
[--auto-spawn-on-failure='<sub-agent>=><fixer-sub-agent>']
[--post-synthesis='<command to run>']
[--precondition-gates=<phase>:<expected-verdict>,...]
```

If you find yourself adding fan-out logic to a command body, **stop**. Add it to `spine-fanout.js` and pass it through as a flag.

---

## 4. Composition rules

### Chaining (the happy path)

```
/think → /plan → /code → /review → /test → /ship → /reflect
```

Each phase's terminal recommendation names the next phase. Phases never silently skip ahead.

### Skipping (allowed in narrow cases)

| Skip | When it's OK | When it isn't |
|---|---|---|
| Skip `/think` | The design space is genuinely closed (e.g. one-line bug fix) | Any feature work; punt to `/think` even briefly |
| Skip `/plan` | A trivial change with one file and one test | Anything cross-package; anything with risk |
| Skip `/review` | NEVER on shipped code | — |
| Skip `/test` | NEVER | — |
| Skip `/ship` | Local-only experiments | Anything users will see |
| Skip `/reflect` | Truly uneventful cycles | Anything that hit a surprise; flakes are surprises |

### Looping back

The spine is a loop, not a one-way conveyor:

- **`/code` → `/plan`** when implementation reveals the design is wrong. Coordinator emits an explicit "design flaw at unit X" recommendation; the user re-runs `/plan` on the offending area.
- **`/review` → `/code`** when verdict is `NEEDS-REWORK`. Specific units named in the loopback.
- **`/test` → `/code`** on any deterministic red. Specific test failures named.
- **`/ship` → `/code`** on build failure (auto-spawned `build-fixer` is the first attempt; if it fails, hand back).
- **`/reflect` → `/think`** every cycle. The retro becomes the next cycle's seed.

Looping back **never** silently rewrites a previous phase's artifact. New artifact, new timestamp, full history.

### Parallel sibling phases

`/review` and `/test` can run in parallel after `/code`. `/ship` waits on both.

```
/code ┬─▶ /review ┐
      └─▶ /test   ┴─▶ /ship → /reflect
```

The fan-out dispatcher does not parallelize across phases on its own — that's the user's call (or the meta-orchestrator's, in CI).

---

## 5. Auxiliaries (`/aw:*` and others)

Auxiliary commands exist outside the spine and are **invoked from within phases**, not on the spine itself. They are not phase-replacers.

| Auxiliary | Source | Invoked from |
|---|---|---|
| `/aw:wiki` | agents-workspace | `/think` problem-frame sub-agent (prior-art lookup) |
| `/aw:delegate` | agents-workspace | `/plan` (deep-dive on a thorny sub-problem) |
| `/aw:implement` | agents-workspace | `/code` (single-agent fallback for trivial changes) |
| `/aw:debug` | agents-workspace | `/code`, `/test` (narrow root-cause analysis) |
| `/aw:agents-skills` | agents-workspace | `/reflect` (skill-mining helper) |
| `/skill-create` | agent_harness | `/code`, `/reflect` (mint a reusable skill) |
| `/build-fix` | agent_harness | `/ship` (auto-spawned build-fixer arm) |
| `/brainstorm` | agents-workspace | `/think` (single-perspective expansion) |
| Per-language reviewers | gstack | `/review` (auto-attached by file extension) |
| Per-language test commands | gstack | `/test` (auto-attached by package language) |

Auxiliaries do not write to the spine's artifact paths. If an auxiliary produces something durable, it's the calling phase's job to fold it into the phase artifact.

---

## 6. Authoring a new spine command vs. a new skill

There are **exactly seven** spine commands. Adding an eighth is a high bar. Use this decision tree:

```
Does the new capability …
├── … define a new pipeline phase that every project would want?
│   └── NO  → it's a skill or auxiliary, not a spine command
│   └── YES → propose in an ADR (docs/decisions/), update SPINE.md and the
│             phase-ownership matrix in COMMAND-NAMESPACING.md, and the
│             collision gate (tools/check-command-collisions.js) before
│             merging
├── … specialize an existing phase for a domain (Python testing, security)?
│   └── It's a sub-agent — add to packages/harness-core/agents/ and reference
│       it from the relevant spine command's --specialists list
├── … is a reusable workflow that's not phase-shaped?
│   └── It's a skill — add under packages/skills-software-factory/ (curated)
│       or generate to ~/.claude/skills/ (generated, per skill-placement policy)
└── … is an integration-specific helper (CI dispatch, vault rotation)?
    └── It's a tool — add to tools/ with matching tests
```

### When you do add a spine command

1. Update SPINE.md (this file): diagram, contract table, artifact paths, composition rules.
2. Update `docs/COMMAND-NAMESPACING.md` phase-ownership matrix.
3. Update `tools/check-command-collisions.js` to enforce the new ownership.
4. Add the command file under `packages/harness-core/commands/<name>.md` following the seven existing files as templates: thin wrapper over `tools/spine-fanout.js`.
5. Add specialist sub-agents under `packages/harness-core/agents/`.
6. Add the synthesis rule to `tools/spine-fanout.js`.
7. Add tests under `packages/harness-core/tests/commands/`.
8. Update the root `README.md` quickstart and the per-CLI flavor docs (`CLAUDE.md`, `AGENTS.md`, `GEMINI.md`).

### When you add a skill instead

Follow `CONTRIBUTING.md` and the skill-placement policy:
- Curated skills (shipped with the harness) go under `packages/skills-*/skills/`.
- Generated/user-imported skills go under `~/.claude/skills/`.
- A skill is invoked, not chained — if you find yourself wiring a skill into a multi-step pipeline, you're rebuilding the spine and should reuse the spine instead.

---

## 7. Implementation notes (for harness-core maintainers)

- **The seven command files are intentionally similar.** They share the same shape: YAML frontmatter, phase header, inputs, outputs, composition section, subsumed-legacy table, fan-out shape table, dispatcher invocation, authoring guidance. Drift between them is a smell — keep them parallel. When you change one, ask whether the same change applies to the other six.
- **Boil-the-Ocean injection is wired at the root, not in the command bodies.** Root `CLAUDE.md` imports `prompt_temp.md`. The PreToolUse hook fires the 10-section checklist before Write/Edit. CI runs the full sweep on PRs. Spine commands inherit this; they do not re-emit it.
- **Specialist sub-agents are first-class.** They live in `packages/harness-core/agents/`, have YAML frontmatter (`name`, `description`, `tools`, `model`), and are versioned with the rest of the package.
- **The synthesis rules are named.** `rank-then-cull`, `pick-one-with-receipts`, `merge-and-cross-check`, `dedupe-and-rank-by-severity`, `matrix-with-flake-detection`, `gate-on-build-then-publish`, `distill-then-mint`. Adding a new spine command means adding a new named synthesis rule. Reuse where possible.
- **Headless mode matters.** The spine commands run interactively in Claude Code, but `tools/spine-fanout.js` also runs headlessly (CI, scheduled tasks, `claude -p`). Behavior must be identical; only the I/O channel differs.

---

## 8. Why the spine works

A pile of agents and skills is a toolkit. A pipeline is a product. The spine forces every contribution to declare its phase and play well with the others. Without it, the harness drifts back into a toolkit. With it, the harness compounds: every cycle's `/reflect` makes the next cycle's `/think` smarter; every `/review` finding shows up in the next `/plan` risk register; every shipped feature feeds back into the patterns minted by the skill-extractor.

The spine is the product. Everything else is parts.
