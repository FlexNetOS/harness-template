# Command Namespacing

> Seven spine commands own seven phases. Auxiliaries live in their own namespaces. Collisions are caught in CI by `tools/check-command-collisions.js`.

This document is the **single source of truth for command ownership** across the harness. If a new contribution introduces a slash command whose name already lives in this matrix, CI fails. The rule is mechanical, not subjective.

---

## Phase-ownership matrix

The seven spine phases own these names. Subsumed legacy commands resolve via alias; auxiliaries from other namespaces (`/aw:*`, language-specific reviewers, etc.) coexist as helpers invoked from within phases.

| Phase | Primary command | Source | Subsumes (renamed/aliased) | Auxiliaries available |
|---|---|---|---|---|
| Diverge | `/think` | gstack | — | `/aw:wiki`, `/brainstorm` |
| Design | `/plan` | gstack (extended w/ agent_harness plan-mode rigor) | agent_harness `/plan` | `/aw:delegate` |
| Build | `/code` | gstack | agent_harness `/skill-create` (utility), `/tdd` (mode flag) | `/aw:implement` |
| Critique | `/review` | gstack | agent_harness `/code-review`, `/security-review` | per-language reviewers (auto) |
| Verify | `/test` | gstack | agent_harness `/tdd` (mode), `/e2e` (mode) | per-language test commands (auto) |
| Deliver | `/ship` | gstack | agent_harness `/build-fix` (utility) | CI dispatch + GHCR publish |
| Learn | `/reflect` | gstack + agent_harness `/learn` merged | agent_harness `/learn` | session-transcript skill extraction |

Every cell in this matrix is enforced. The ownership is final.

---

## Reserved names (cannot be reused)

The seven primary spine names are **reserved root-level slash commands**:

```
/think  /plan  /code  /review  /test  /ship  /reflect
```

No package, plugin, or template may register a slash command with one of these names. Aliases for legacy compatibility (e.g. `/code-review` → `/review`) are configured in `tools/check-command-collisions.js` and resolve at dispatch time, not at registration time.

---

## Auxiliary namespaces

Auxiliaries live in **explicit namespaces** and never collide with the spine:

| Namespace | Source | Purpose |
|---|---|---|
| `/aw:*` | agents-workspace | Single-purpose helpers invoked from inside spine phases (`/aw:wiki`, `/aw:delegate`, `/aw:implement`, `/aw:debug`, `/aw:agents-skills`) |
| `/skill-*` | agent_harness | Skill lifecycle utilities (`/skill-create`, `/skill-health`) |
| `/build-*` | agent_harness | Build-time utilities auto-invoked by `/ship` (`/build-fix`) |
| Per-language `<lang>-{review,test,build}` | gstack | Auto-attached to the relevant spine phase by file extension or package language |

Auxiliary commands must:
1. Use a namespace prefix (or a clearly non-spine name like `/build-fix`).
2. Be invoked **from within** a spine phase, not on the spine itself, in production usage.
3. Be listed in the matrix above when they are first-class (subsumed-legacy or always-on).

Direct user invocation of an auxiliary is allowed (e.g. running `/skill-create` outside `/code`), but any documented workflow that strings auxiliaries together is a candidate to be folded into a spine phase instead.

---

## Adding a new command without colliding

Use this decision tree (the same one in `docs/SPINE.md`, restated for the namespacing perspective):

```
Is the new command …
├── … one of the seven spine names?            → already taken; cannot add
├── … a new pipeline phase?                    → high bar — propose an ADR,
│                                                update this matrix and SPINE.md,
│                                                update tools/check-command-collisions.js
├── … specialization of an existing phase?     → it's a specialist sub-agent,
│                                                not a slash command
├── … a single-purpose helper?                 → add under an auxiliary namespace
│                                                (/aw:*, /skill-*, etc.)
└── … language- or stack-specific?             → add to packages/skills-software-factory/
                                                  with a clearly scoped name
                                                  (e.g. /python-format, not /format)
```

Rules of thumb:
- **Never claim a generic verb** at the root level. `/build`, `/deploy`, `/refactor`, `/format` are off-limits — they belong as sub-actions of spine phases or as namespaced auxiliaries.
- **Namespace early.** A name that "feels generic but is actually about Foo" should be `/foo:*` from day one.
- **Update the matrix.** If you add a first-class auxiliary, list it in the auxiliaries-available column of the relevant spine phase, and (if applicable) add an alias entry to the collision gate.

---

## CI gate (`tools/check-command-collisions.js`)

The collision gate is **the enforcement mechanism** for this document. It runs on every PR via `.github/workflows/ci.yml`.

The gate:
1. Scans every `commands/*.md` and `skills/*/SKILL.md` across the workspace for slash-command registrations.
2. Builds a registry: `(slash-name → defining file)`.
3. Compares against the phase-ownership matrix in this file (parsed from the markdown table).
4. Fails CI if:
   - A non-spine file claims one of the seven reserved names.
   - Two files claim the same auxiliary name without an explicit alias entry.
   - An auxiliary claims a name without a recognized namespace prefix or matrix listing.

Output is a structured comment on the PR with the conflicting file paths and a suggested rename.

To check locally before pushing:

```bash
node tools/check-command-collisions.js
```

Exit code 0 = no collisions; non-zero = collisions, with a human-readable report on stderr.

To register a deliberate alias (e.g. for a subsumed legacy command), add an entry to the gate's `KNOWN_ALIASES` table — alongside a one-line justification. Aliases are auditable, not silent.

---

## When this document changes

Update this document **before** merging a PR that adds, renames, or subsumes a command. The order is strict:

1. Edit the matrix above.
2. Update `tools/check-command-collisions.js` to match.
3. Update `docs/SPINE.md` if the change affects a spine phase.
4. Update the affected command file(s) under `packages/harness-core/commands/`.
5. Add or update tests under `packages/harness-core/tests/commands/`.
6. Open the PR; CI re-checks the gate.

Skipping step 1 or 2 is what produces collisions in the first place.
