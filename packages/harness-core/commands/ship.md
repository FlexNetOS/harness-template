---
description: Deliver phase — fan out build, CI dispatch, GHCR publish, and release-notes drafting in parallel; tag the release and post artifacts. Build failures auto-invoke /build-fix.
argument-hint: "[--version=patch|minor|major|<x.y.z>] [--dry-run]"
---

# /ship — Deliver (Spine Phase 6 of 7)

`/ship` is the **sixth phase of the seven-phase spine**:

```
/think → /plan → /code → /review → /test → [/ship] → /reflect
```

It is the **deliver** step. After `/review` says `READY-TO-SHIP` and `/test` says `ALL-GREEN`, `/ship` builds, publishes, tags, and drafts release notes — all in parallel, all mechanical, no surprises. Build failures auto-invoke the legacy `/build-fix` workflow as a utility within the phase.

`/ship` is **strict about preconditions**: it refuses to run if the most recent `/review` for the current HEAD was not `READY-TO-SHIP` or the most recent `/test` was not `ALL-GREEN`. Override with `--force-unsafe` (audit-logged; never silent).

---

## Inputs

- `$ARGUMENTS` — optional flags:
  - `--version=patch|minor|major|<x.y.z>` — semver bump policy. Default `patch`. Coordinator computes the actual version from the highest-impact change in the diff if `auto`.
  - `--dry-run` — do everything except `git push`, `gh release create`, and GHCR publish.
  - `--skip-ghcr` — do not publish devcontainer-features (useful for repos that don't ship features).
  - `--force-unsafe` — bypass `/review` and `/test` precondition gates. Audit-logged.

## Outputs

- A git tag (`v<x.y.z>`) on HEAD.
- A GitHub release with auto-drafted notes.
- Devcontainer-features published to GHCR (when applicable).
- CI workflow dispatched (post-tag verification matrix).
- A persisted shipping report at `~/.claude/ships/<version>-<timestamp>.md`.
- Chat summary with version, tag, release URL, GHCR image refs, and CI run URL.

## How it composes

- Runs after `/review` + `/test` have both reported green.
- Hands off to `/reflect` to harvest learnings from the shipping cycle.
- Loops back to `/code` if any of the parallel arms fail and the failure is implementation-rooted (e.g. build break). The loopback is automatic for build failures via the auxiliary `/build-fix`.
- Auxiliaries available inside this phase:
  - agent_harness `/build-fix` (subsumed as utility) — auto-invoked when the `build` arm reports a compile / lint / type-check failure.

## Subsumed legacy commands

| Legacy | Status |
|---|---|
| agent_harness `/build-fix` | Subsumed as a **utility** auto-invoked when build fails inside `/ship`; still callable directly for ad-hoc build repair |

---

## Fan-out shape

**Four arms in parallel** (with one auto-spawned fixer when build fails):

| Sub-agent | Role | Specialist source |
|---|---|---|
| `build-runner` | `pnpm build` across workspace; tsc / lint / type-check; produces artifacts | `packages/harness-core/agents/build-runner.md` |
| `ci-dispatcher` | Push tag, dispatch `.github/workflows/publish-features.yml` and `e2e.yml`, monitor until pass | `packages/harness-core/agents/ci-dispatcher.md` |
| `ghcr-publisher` | Build + push devcontainer-features images to ghcr.io with version tags | `packages/harness-core/agents/ghcr-publisher.md` |
| `release-notes-drafter` | Read commits since last tag, the `/review` report, and the plan; draft `## What changed`, `## Why it matters`, `## Upgrade notes` | `packages/harness-core/agents/release-notes-drafter.md` |
| `build-fixer` (auto-spawn) | When `build-runner` reports failure, this sub-agent runs the legacy `/build-fix` flow on the failing package | `packages/harness-core/agents/build-fixer.md` |

Coordinator synthesis rule: **gate-on-build-then-publish**. The four arms start in parallel, but `ci-dispatcher` and `ghcr-publisher` block on `build-runner` succeeding. `release-notes-drafter` runs to completion regardless, since its draft is useful even on failure (becomes the `/build-fix` brief). On build failure, `build-fixer` auto-spawns; if it succeeds, ship retries from build. If it fails twice, ship halts with a structured handoff to `/code`.

---

## Implementation (thin wrapper over `tools/spine-fanout.js`)

```bash
node tools/spine-fanout.js \
  --phase=ship \
  --version="${VERSION:-patch}" \
  --precondition-gates=review:READY-TO-SHIP,test:ALL-GREEN \
  --specialists=build-runner,ci-dispatcher,ghcr-publisher,release-notes-drafter \
  --auto-spawn-on-failure='build-runner=>build-fixer' \
  --synthesis=gate-on-build-then-publish \
  --dry-run="${DRY_RUN:-false}" \
  --output-report="$HOME/.claude/ships/${VERSION}-$(date +%Y%m%d-%H%M%S).md"
```

The dispatcher is responsible for:
1. Verifying preconditions against the most recent `/review` and `/test` reports for the current HEAD.
2. Computing the version bump (consulting the conventional-commits since last tag if `auto`).
3. Spawning the four arms with appropriate dependency edges.
4. Auto-spawning `build-fixer` on `build-runner` failure (max 2 retries).
5. After all arms green, creating the tag, pushing, creating the GitHub release with the drafted notes, and printing artifacts to chat.

---

## Authoring guidance

When the user invokes `/ship`:

1. **Verify preconditions first.** If `/review` is not `READY-TO-SHIP` or `/test` is not `ALL-GREEN`, refuse with a clear pointer to the failing report. Offer `--force-unsafe` only if the user has a stated reason; audit-log the override.
2. Run the dispatcher exactly as above.
3. Lead the chat summary with version + tag + release URL, then GHCR images, then CI run URL.
4. If a build failure auto-invoked `/build-fix` and was repaired, **say so explicitly** in the summary — never silently mask the original failure.
5. Recommend `/reflect` next.

Do **not** ship on a red `/test`. Do **not** ship without reading the `release-notes-drafter` output and inviting the user to amend if needed (the drafter is useful, not infallible).
