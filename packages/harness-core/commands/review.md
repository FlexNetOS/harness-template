---
description: Critique phase — fan out four reviewers in parallel (security, performance, tests, architecture), run the boil-review 10-section sweep, and post a unified severity-tagged report.
argument-hint: "<PR url, branch name, or 'staged'>"
---

# /review — Critique (Spine Phase 4 of 7)

`/review` is the **fourth phase of the seven-phase spine**:

```
/think → /plan → /code → [/review] → /test → /ship → /reflect
```

It is the **critique** step. After `/code` produces a change, four specialist reviewers go over it in parallel — each with a single concern — and a coordinator merges their findings into one unified, severity-tagged report. The Boil-the-Ocean 10-section sweep (`tools/boil-review.js --quick`) is run as part of synthesis, ensuring no completeness gaps slip through.

This phase **subsumes both `/code-review` and the dedicated security-review pass** — security is one of the four parallel reviewers (`security-reviewer` agent), not a separate command.

---

## Inputs

- `$ARGUMENTS` — review target. One of:
  - PR URL (`https://github.com/owner/repo/pull/123`) — fetched via `gh`.
  - Branch name (e.g. `feature/foo`) — diffed against `main` (or configured base).
  - `staged` — review the currently staged diff.
  - `working` — review the working tree (staged + unstaged).
- Optional flags:
  - `--reviewers=<list>` — override the default four (e.g. `--reviewers=security,tests` to run only two).
  - `--severity-threshold=<info|low|medium|high|critical>` — only surface findings at or above this threshold in the chat summary; full report is always written.
  - `--no-boil` — skip the `boil-review.js --quick` synthesis step (rare; not recommended).

## Outputs

- A unified review report in chat with:
  - **Critical** findings up top (red), each with file:line and a recommended fix
  - **High / Medium / Low / Info** rolled up below
  - 10-section Boil-the-Ocean coverage table from `boil-review.js --quick`
  - Per-reviewer breakdown for traceability
- A persisted copy at `~/.claude/reviews/<slug>-<timestamp>.md` (consumed by `/ship` for release notes and by `/reflect` for pattern extraction).
- A go/no-go verdict line: `READY-TO-SHIP`, `READY-AFTER-FIXES`, or `NEEDS-REWORK`.

## How it composes

- Consumes the diff produced by `/code`. Can also be invoked standalone on any PR or branch.
- Hands off to `/test` (verify) and then `/ship` (deliver). Coordinator will not recommend `/ship` unless verdict is `READY-TO-SHIP`.
- Loops back to `/code` if `NEEDS-REWORK`. Coordinator suggests which unit needs the fix.
- Auxiliaries available inside this phase: any of the existing language-specific reviewers in `packages/skills-software-factory/skills/` (e.g. `python-review`, `cpp-review`) — selected automatically by file extension.

## Subsumed legacy commands

| Legacy | Status |
|---|---|
| agent_harness `/code-review` | Subsumed — its single-reviewer pass is now the `architecture` sub-agent inside the parallel fan-out |
| agent_harness security-review skill | Subsumed — its OWASP / secrets / auth focus is now the `security-reviewer` sub-agent |
| gstack per-language reviewers (`python-review`, `cpp-review`, `flutter-review`, etc.) | Retained as auxiliaries; auto-invoked by file extension when relevant |

---

## Fan-out shape

Four reviewers run **in parallel**, plus a coordinator merges and runs the Boil sweep:

| Sub-agent | Concern | Specialist source |
|---|---|---|
| `security-reviewer` | OWASP top 10, secrets, authn/authz, supply-chain, injection, deserialization | `packages/harness-core/agents/security-reviewer.md` |
| `performance-reviewer` | N+1, hot paths, allocations, async pitfalls, caching opportunities | `packages/harness-core/agents/performance-reviewer.md` |
| `tests-reviewer` | Coverage gaps, mocked-vs-real, flake risk, test hygiene, missing edge cases | `packages/harness-core/agents/tests-reviewer.md` |
| `architecture-reviewer` | Layering, contracts, abstractions, dependency direction, naming, repo conventions | `packages/harness-core/agents/architecture-reviewer.md` |

Coordinator synthesis rule: **dedupe-and-rank-by-severity**, then run `tools/boil-review.js --quick` on the combined diff to stamp 10-section coverage onto the report. The coordinator:

1. Collects findings from all four reviewers.
2. Deduplicates by (file, line, finding-class) — a single bug surfaced by multiple reviewers becomes one row with multiple endorsers (raises confidence).
3. Sorts by severity, then by blast radius.
4. Runs `boil-review.js --quick` and merges the 10-section table.
5. Computes the verdict from severity counts and Boil coverage.

---

## Implementation (thin wrapper over `tools/spine-fanout.js`)

```bash
node tools/spine-fanout.js \
  --phase=review \
  --target="$ARGUMENTS" \
  --specialists=security-reviewer,performance-reviewer,tests-reviewer,architecture-reviewer \
  --auto-add-language-reviewers \
  --synthesis=dedupe-and-rank-by-severity \
  --post-synthesis="node tools/boil-review.js --quick --diff=$(git diff --name-only ${BASE}...HEAD)" \
  --output-report="$HOME/.claude/reviews/${SLUG}-$(date +%Y%m%d-%H%M%S).md"
```

The dispatcher is responsible for:
1. Materializing the diff (from PR, branch, or staging area) and passing it to each reviewer.
2. Auto-attaching language-specific reviewers based on changed file extensions when `--auto-add-language-reviewers` is set.
3. Awaiting all reviewers in parallel.
4. Running `dedupe-and-rank-by-severity` synthesis.
5. Running `tools/boil-review.js --quick` and merging the 10-section coverage table.
6. Writing the report and printing the chat summary.

---

## Authoring guidance

When the user invokes `/review`:

1. Confirm the target. If `staged` and no diff exists, say so and stop.
2. Run the dispatcher exactly as above.
3. Lead the chat summary with the verdict line, then critical findings, then the rest.
4. If verdict is `NEEDS-REWORK`, name the specific unit/file in the recommendation — do not say "fix things and try again."

Do **not** soften critical findings. Do **not** skip the Boil sweep — it is the terminal completeness check, and it is what makes `/review` more than the sum of its four reviewers.
