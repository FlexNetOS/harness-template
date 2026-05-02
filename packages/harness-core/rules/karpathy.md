# Karpathy Coding Guidelines (always-on rule)

This rule loads in every conversation. Behavioral defaults for engineering work,
synthesized from [Andrej Karpathy's observations](https://x.com/karpathy/status/2015883857489522876)
on common LLM coding failure modes.

**Tradeoff:** these guidelines bias toward caution over speed. For trivial tasks
(typo fixes, obvious one-liners) use judgment — not every change needs the full rigor.

## Principles

### 1. Think before coding

Don't assume. Don't hide confusion. Surface tradeoffs.

- State your assumptions explicitly. If you're uncertain, ask instead of guessing.
- If multiple interpretations of the request exist, present them — don't pick silently.
- If a simpler approach exists than the one requested, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

### 2. Simplicity first

Minimum code that solves the problem. Nothing speculative.

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

The test: would a senior engineer say this is overcomplicated? If yes, simplify.

### 3. Surgical changes

Touch only what you must. Clean up only your own mess.

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it — don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that *your* changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: every changed line should trace directly to the user's request.

### 4. Goal-driven execution

Define success criteria. Loop until verified.

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass."
- "Fix the bug" → "Write a test that reproduces it, then make it pass."
- "Refactor X" → "Ensure tests pass before and after."

For multi-step tasks, state a brief plan:

```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work")
require constant clarification.

## How to apply

- **At the start of any non-trivial task**, restate the goal in your own words,
  list the assumptions you're making, and (if anything is ambiguous) ask before coding.
- **When tempted to abstract early**, don't. Write the concrete one-shot solution
  first; extract abstractions only when a second caller actually appears.
- **When suggesting changes**, prefer surgical to sweeping. If a drive-by cleanup
  is tempting, mention it as a separate follow-up rather than folding it into the
  current diff.
- **Before declaring done**, name how you'd verify success — a test that fails
  before and passes after, a command whose output proves the behavior, or a
  manual check the user can repeat.
- **For trivial fixes** (typos, single-line obvious bugs), skip the ceremony.
  This rule is about non-trivial work.

## Why

These principles reduce common LLM coding failure modes — over-abstraction,
premature optimization, drive-by refactoring, under-grounded changes, and
silent assumptions that turn into rework. They apply across any project in
this harness, regardless of language or domain.

The full skill (with worked examples) lives at
`packages/skills-guidelines/skills/karpathy-guidelines/SKILL.md`. Examples
demonstrating each principle are in `packages/skills-guidelines/EXAMPLES.md`.
