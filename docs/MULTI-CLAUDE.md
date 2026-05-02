# Multi-Claude — the spine-fanout pattern

> How a single slash command in your editor turns into parallel calls to
> multiple specialist sub-agents across multiple AI CLIs. For the
> overall package layout, see [ARCHITECTURE.md](./ARCHITECTURE.md). For
> CLI authentication, see [CLI-AUTH.md](./CLI-AUTH.md).

## The problem

Real engineering tasks are not one prompt. *"Fix this bug"* expands into:

- Reproduce it.
- Read the surrounding code.
- Propose 2–3 fixes.
- Pick one, with a rationale.
- Write the test.
- Write the fix.
- Update the docs.
- Open a PR.

A single agent doing all of this serially is slow and easy to derail.
Worse, you often want **a different model for each step** — a thinking-heavy
model for the rationale, a code-heavy model for the patch, a fast cheap
model for the doc update.

The **spine-fanout** pattern in `packages/spine-fanout/` solves this:
one user-visible "spine" command (e.g. `/spine fix-bug`) dispatches a
graph of specialist sub-agents in parallel, each with its own model,
prompt, and tool set, and merges their results.

## Architecture

```
                    ┌─────────────────────────────┐
   User: /spine X ──▶  spine-fanout dispatcher    │
                    │  packages/spine-fanout/      │
                    └──────────────┬──────────────┘
                                   │
              ┌────────────────────┼────────────────────┐
              ▼                    ▼                    ▼
       ┌──────────────┐    ┌──────────────┐     ┌──────────────┐
       │ specialist A │    │ specialist B │ ... │ specialist N │
       │ (Claude)     │    │ (Codex)      │     │ (Gemini)     │
       └──────┬───────┘    └──────┬───────┘     └──────┬───────┘
              │                   │                    │
              └─────────┬─────────┴────────┬───────────┘
                        ▼                  ▼
                   ┌─────────────────────────────┐
                   │  merge step (a final agent  │
                   │  that consolidates outputs) │
                   └──────────────┬──────────────┘
                                  ▼
                          structured result
                          posted to user
```

Each "specialist" is a sub-agent definition (markdown + YAML
frontmatter) under `packages/prompt-library/agents/`. Each "spine
command" is a YAML file under `packages/spine-fanout/spines/<name>.yaml`
that lists the specialists, their inputs, and the merge strategy.

## A worked example: `/spine fix-bug`

```yaml
# packages/spine-fanout/spines/fix-bug.yaml
id: fix-bug
description: Reproduce, propose, fix, test, document a reported bug.
inputs:
  - name: bug_url
    description: GitHub issue or PR URL
    required: true

steps:
  - id: reproduce
    agent: bug-reproducer    # claude, model: opus
    inputs: { url: ${{ inputs.bug_url }} }

  - id: propose
    agent: fix-proposer      # claude, model: opus
    inputs: { repro: ${{ steps.reproduce.output }} }

  # Fan out: try the patch in two CLIs, pick the better diff.
  - id: patch
    parallel:
      - agent: codex-patcher  # codex
        inputs: { plan: ${{ steps.propose.output }} }
      - agent: claude-patcher # claude, model: sonnet
        inputs: { plan: ${{ steps.propose.output }} }
    merge: pick-best-diff

  - id: test
    agent: test-writer        # claude, model: sonnet
    inputs:
      patch: ${{ steps.patch.output }}
      repro: ${{ steps.reproduce.output }}

  - id: docs
    agent: docs-updater       # gemini, model: flash
    inputs: { patch: ${{ steps.patch.output }} }

output:
  template: ./fix-bug.report.md.ejs
```

When the user types `/spine fix-bug https://github.com/.../issues/42`,
the dispatcher reads this file, walks the step graph, runs steps in
parallel where allowed, and renders the final report.

## Authoring a new specialist

Specialists live under `packages/prompt-library/agents/`. Each one is a
markdown file with frontmatter:

```markdown
---
name: bug-reproducer
description: Given a bug report URL, produce a minimal local reproduction.
cli: claude                   # claude | codex | gemini
model: claude-opus-4-7        # leave blank to use the CLI's default
tools: [Read, Bash, Grep]
inputs:
  - { name: url, type: string, required: true }
outputs:
  - { name: repro, type: string, description: "shell snippet that reproduces" }
---

You are a bug-reproduction specialist. Given a bug report at {{ url }},
your job is to produce the smallest possible shell snippet that
reproduces the failure on a clean checkout. Do not attempt to fix the
bug. ...
```

Rules:

- The `cli` field decides which executable spine-fanout shells out to.
  See [CLI-AUTH.md](./CLI-AUTH.md) for credentials.
- The `tools` field is a hard allowlist. The dispatcher refuses to start
  the agent if it's missing.
- Outputs are JSON-typed. The dispatcher validates them before passing
  them to the next step.
- Drop the file in `packages/prompt-library/agents/` and add a unit
  test that round-trips the frontmatter. The boil-review engine will
  fail PRs missing the test.

## Authoring a new spine

1. Add `packages/spine-fanout/spines/<name>.yaml` (see above).
2. Add an EJS report template at `spines/<name>.report.md.ejs`.
3. Add an end-to-end test that runs the spine with a fixture issue and
   asserts on the rendered report.
4. Document it in this file's "Built-in spines" table below.

## Built-in spines

| Spine                | What it does                                                  |
| -------------------- | ------------------------------------------------------------- |
| `/spine plan`        | Turn a feature request into a multi-PR plan with sequencing.  |
| `/spine fix-bug`     | The example above.                                            |
| `/spine review`      | Run boil-review locally and propose fixes for each finding.   |
| `/spine docs-sync`   | Find drift between code and docs; propose patches.            |
| `/spine release`     | Draft release notes and a changelog from the last tag.        |

## Why split CLIs?

- **Cost.** Doc updates rarely need a frontier model. Routing them to
  Gemini Flash or Claude Haiku saves dollars at scale.
- **Specialization.** Codex's tool calling is great for patching;
  Claude's planning is hard to beat. Use each where it wins.
- **Resilience.** When one provider's API is having a bad day, a spine
  with mixed CLIs degrades gracefully.

## Further reading

- Anthropic Claude Agent SDK:
  https://docs.anthropic.com/en/api/agent-sdk-overview
- Sub-agent format spec (in this repo):
  [`packages/prompt-library/AGENTS.md`](../packages/prompt-library/AGENTS.md)
- The MCP integration story: [ARCHITECTURE.md](./ARCHITECTURE.md#7-vault-tools)
- CLI auth flows: [CLI-AUTH.md](./CLI-AUTH.md)
- Where these live in your spawned project: [SPAWNER.md](./SPAWNER.md)
