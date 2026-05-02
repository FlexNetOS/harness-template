# Boil the Ocean

> *"Ship the finished product on turn 1: code + tests + docs, no
> workarounds, no 'tabled for later', fix dangling threads inline."*
> — `prompt_temp.md`, the seed of this whole repo

This document explains the three-layer prompt-injection model that powers
the harness, how `tools/boil-review.js` enforces it, and how to write your
own review extensions.

For the higher-level picture, start with [ARCHITECTURE.md](./ARCHITECTURE.md).
For the spawner that drops these into a new project, see
[SPAWNER.md](./SPAWNER.md).

## Why "boil the ocean"

The default failure mode of LLM-assisted coding is to leave 80% of the
work done and the last 20% described as *future work*. The boil-the-ocean
standard says: **finish it now**. Every PR ships its own code, tests, and
docs. Every review pass closes its own loose ends. Every spawn yields a
fully-running project, not a TODO list.

The three-layer model below is how we actually pull that off without
burning every model token on boilerplate.

## The three-layer injection

Each spawned project carries three prompt layers, applied in order, with
clearly different lifetimes:

```
┌───────────────────────────────────────────────────────────┐
│  Layer 1: ALWAYS-ON  (CLAUDE.md, AGENTS.md)               │
│  ────────────────────────────────────────────────────     │
│  Loaded for every turn, every session, forever.           │
│  Holds: project conventions, file-naming rules, the       │
│  boil-the-ocean standard itself, hard "never do X" rules. │
│  Tiny — under 2 KB. Curated by hand, edited rarely.       │
└───────────────────────────────────────────────────────────┘
                          │
                          ▼
┌───────────────────────────────────────────────────────────┐
│  Layer 2: ACTIVE     (.claude/skills/, .claude/agents/)   │
│  ────────────────────────────────────────────────────     │
│  Loaded by skill/agent name on demand.                    │
│  Holds: workflows ("/tdd", "/plan", "/spine *"),          │
│  domain knowledge bundles, sub-agent definitions.         │
│  Medium — 10s of files, each focused on one topic.        │
│  Edited weekly as the workflow evolves.                   │
└───────────────────────────────────────────────────────────┘
                          │
                          ▼
┌───────────────────────────────────────────────────────────┐
│  Layer 3: TERMINAL   (PR comment, hook output, slash arg) │
│  ────────────────────────────────────────────────────     │
│  Loaded once, per turn, in response to a trigger.         │
│  Holds: boil-review findings, hook messages,              │
│  slash-command arguments, the user's literal prompt.      │
│  Ephemeral — vanishes at end of turn.                     │
└───────────────────────────────────────────────────────────┘
```

Layer 1 sets the *standard*. Layer 2 supplies the *playbook*. Layer 3
delivers the *evidence* (findings, errors, the actual ask). Mixing them
up is the most common authoring mistake — see "Common pitfalls" below.

## How `boil-review.js` works

`tools/boil-review.js` is invoked by `.github/workflows/boil-review.yml`
on every PR. It loads the rule library from `packages/boil-review/`, runs
each rule over the changed files, and emits a single JSON document on
stdout.

```json
{
  "summary": "Reviewed 12 files across 3 packages.",
  "findings": [
    {
      "rule": "no-tabled-for-later",
      "severity": "critical",
      "path": "packages/project-spawner/src/render.ts",
      "line": 142,
      "message": "Found 'TODO: implement in follow-up' — boil-the-ocean disallows."
    }
  ]
}
```

Severity levels:

| Severity   | Effect on CI                                     |
| ---------- | ------------------------------------------------ |
| `critical` | **Blocks merge.** The workflow exits non-zero.   |
| `warning`  | Posted in the PR comment. Does not block.        |
| `info`     | Posted in the PR comment, collapsed by default.  |

The workflow always posts a single comment per PR, updating it in place
across pushes (it looks for the `## Boil-the-Ocean Review` marker).

## Authoring a new rule

A rule is a `.js` or `.ts` file under
`packages/boil-review/src/rules/<your-rule>.ts` that exports:

```ts
import type { Rule, Finding } from '../types';

export const rule: Rule = {
  id: 'my-rule-id',                       // unique, kebab-case
  description: 'One-line summary of what this catches.',
  defaultSeverity: 'warning',             // critical | warning | info

  // Called once per file in the changed set.
  check(file, ctx): Finding[] {
    if (!file.path.endsWith('.ts')) return [];
    const findings: Finding[] = [];
    for (const [i, line] of file.lines.entries()) {
      if (line.includes('// XXX')) {
        findings.push({
          rule: 'my-rule-id',
          severity: 'warning',
          path: file.path,
          line: i + 1,
          message: 'Use TODO(owner) instead of XXX for unfinished work.',
        });
      }
    }
    return findings;
  },
};
```

Register it in `packages/boil-review/src/rules/index.ts`. Add a unit
test in the same package. Run `pnpm verify` and you're done — the next
PR that trips it gets a comment.

## Authoring a new extension (cross-cutting)

Sometimes a check needs more than per-file scanning. For example, "every
new package must have a `README.md`" requires diff-aware logic. That goes
in `packages/boil-review/src/extensions/<name>.ts` and gets the full
review context (changed files, base ref, repo metadata) instead of a
single file.

Extensions emit findings with the same shape. They run after the
per-file rules.

## Common pitfalls

- **Putting workflow rules in Layer 1.** Layer 1 is loaded *every turn*.
  If your rule is "when refactoring auth, do X," that belongs in a
  Layer-2 skill, not in `CLAUDE.md`. Keep Layer 1 universal.
- **Re-emitting the same finding from multiple rules.** Use distinct
  `rule.id`s and let the comment renderer group them.
- **Critical findings without a fix.** A critical finding *must* describe
  what to do, not just what's wrong. The PR author has to be able to
  unblock themselves.

## Reference: the boil-the-ocean standard (verbatim)

These lines come straight from the [feedback completeness standard](
../../.claude/projects/__shared/feedback_completeness_standard.md). They
are quoted here because they are the load-bearing definition that every
rule ultimately points back at.

> Ship the finished product on turn 1: code + tests + docs, no
> workarounds, no "tabled for later", fix dangling threads inline.

> Don't gold-plate, but don't leave it half-done. When you complete the
> task, respond with a concise report covering what was done and any key
> findings.

> If you find an out-of-scope issue worth fixing, flag it for a separate
> task — don't bloat the current change.

These three sentences are the test the review engine ultimately runs
against. Every rule should be a mechanical proxy for one of them.

## Cross-references

- Architecture overview: [ARCHITECTURE.md](./ARCHITECTURE.md)
- Spawner CLI (puts these rules into your project): [SPAWNER.md](./SPAWNER.md)
- Multi-agent spine (consumes findings as Layer-3 input): [MULTI-CLAUDE.md](./MULTI-CLAUDE.md)
- CI integration: [`.github/workflows/boil-review.yml`](../.github/workflows/boil-review.yml)
