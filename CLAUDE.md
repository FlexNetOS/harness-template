# CLAUDE.md — harness-template (root)

This file is loaded into every Claude conversation in this repository. It establishes
the always-on operating standard for the harness and links to per-package instructions.

---

## OPERATING STANDARD — Boil the Ocean (Garry Tan)

> Remember when implementing: The marginal cost of completeness is near zero with AI.
> Do the whole thing. Do it right. Do it with tests. Do it with documentation. Do it
> so well that the user is genuinely impressed — not politely satisfied, actually
> impressed. Never offer to "table this for later" when the permanent solve is within
> reach. Never leave a dangling thread when tying it off takes five more minutes.
> Never present a workaround when the real fix exists. The standard isn't "good enough"
> — it's "holy shit, that's done." Search before building. Test before shipping. Ship
> the complete thing. When asked for something, the answer is the finished product,
> not a plan to build it. Time is not an excuse. Fatigue is not an excuse. Complexity
> is not an excuse. Boil the ocean.

### When it is done, it is obvious

- The battle is decided before it begins. Search the ground. Map what exists.
  Know every path before you take a step.
- Do not wage war twice. Build once, build completely. A half-built system is
  a wounded army.
- Reject the illusion of speed. A shortcut that breaks is slower than a clean
  strike. Choose the true fix over the easy patch.
- Leave no loose ends. A single gap invites failure. Seal everything before
  you declare victory.
- Test like an enemy is probing every weakness. If it can break, it will break.
  Remove that possibility.
- Documentation is supply lines. Without it, even a strong system collapses.
- Do not present plans. Deliver outcomes. The answer is the finished work,
  not the promise of it.
- When the task is given, assume total responsibility. Time, fatigue, and
  complexity are not factors. They are distractions.
- Victory standard is not acceptable. Victory is decisive. When it is done,
  it is obvious.

The injection is mechanically enforced at three layers:

1. **Always-on framing** — this CLAUDE.md (and every per-package CLAUDE.md) imports
   the injection so every conversation starts framed.
2. **Active checkpoint** — `packages/harness-core/hooks/pre-tool-boil.json` runs
   `tools/boil-review.js --quick` before any Write/Edit/MultiEdit call.
3. **Terminal gate** — `.github/workflows/boil-review.yml` runs the full 10-section
   sweep on every PR. Critical gaps fail the build.

See [docs/BOIL-THE-OCEAN.md](docs/BOIL-THE-OCEAN.md).

---

## CODING BEHAVIOR — Karpathy Guidelines

The Andrej Karpathy "behavioral guidelines for coding" rule is loaded into every
conversation as well. See [packages/harness-core/rules/karpathy.md](packages/harness-core/rules/karpathy.md).

Summary: think before coding, simplicity first, surgical changes, goal-driven
execution, search before building, no over-abstraction, no premature optimization.

---

## ARCHITECTURE — The Slash-Command Spine

This harness is a unified end-to-end pipeline expressed as slash commands:

```
/think → /plan → /code → /review → /test → /ship → /reflect
```

Each phase is a multi-Claude fan-out (specialist sub-agents in parallel), implemented
through the shared dispatcher at `tools/spine-fanout.js`.

- **Spine commands** live in `packages/harness-core/commands/`.
- **Auxiliaries** (agents-workspace) use the `/aw:` prefix and are invoked from within phases.
- **Software-factory utilities** (~33 commands from gstack) live in `packages/skills-software-factory/`.

See [docs/SPINE.md](docs/SPINE.md) and [docs/MULTI-CLAUDE.md](docs/MULTI-CLAUDE.md).

The phase-ownership matrix is enforced by `tools/check-command-collisions.js` (CI gate).

---

## REPOSITORY MAP

| Path | Purpose |
|---|---|
| `.devcontainer/` | The turnkey devcontainer (Claude/Codex/Gemini CLIs + sops/age + pnpm) |
| `packages/harness-core/` | Agents, commands (spine), hooks, rules, scripts, tests |
| `packages/skills-foundation/` | agents-workspace meta-skills (`/aw:wiki`, `/aw:delegate`, etc.) |
| `packages/skills-domain/` | Domain skills (accessibility, api-design, etc.) |
| `packages/skills-guidelines/` | Karpathy + other behavioral guideline skills |
| `packages/skills-software-factory/` | gstack utilities (~33 non-spine commands) |
| `packages/devcontainer-features/` | Features published to GHCR |
| `packages/project-spawner/` | `harness-spawn` CLI |
| `templates/node-postgres-claude/` | Reference stack for the spawner |
| `tools/` | Cross-cutting Node utilities (boil-review, spine-fanout, etc.) |
| `docs/` | All architecture, vault, CLI-auth, multi-claude docs |

Per-package `CLAUDE.md` files override or extend this root context with package-specific
instructions.

---

## SECURITY POSTURE

- Secrets stream from `.env.sops` at devcontainer boot via `sops -d`. `.env` is **never**
  written to disk. See [docs/VAULT.md](docs/VAULT.md).
- Three-CLI auth flows documented at [docs/CLI-AUTH.md](docs/CLI-AUTH.md).
- Vulnerability disclosure: [SECURITY.md](SECURITY.md).
