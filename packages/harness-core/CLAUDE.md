# harness-core — package context

Per-package guidance for `@harness-template/core`. The repo root `CLAUDE.md` already
imports the Boil-the-Ocean injection (`prompt_temp.md`) and the always-on Karpathy
behavioral rule (`rules/karpathy.md`, owned by sub-agent D). **Do not duplicate that
content here** — this file adds package-local rules only.

## What this package owns

- **Spine commands.** The seven-phase slash-command pipeline (`/think`, `/plan`,
  `/code`, `/review`, `/test`, `/ship`, `/reflect`) lives under `commands/`. Each
  command is a thin Markdown wrapper that fans out to specialist agents via
  `tools/spine-fanout.js` (repo root). Auxiliary commands (e.g. `/skill-create`,
  `/security-review`, `/learn-eval`) live alongside the spine but are *not* on the
  pipeline.
- **Always-on hooks.** The PreToolUse, PostToolUse, Stop, and SessionStart/SessionEnd
  hook specs live under `hooks/`. The active-checkpoint Boil-the-Ocean hook
  (`hooks/pre-tool-boil.json`) is what fires the 10-section sweep before every
  `Write|Edit|MultiEdit`. Layer 1 (CLAUDE.md import) and Layer 3 (CI gate) live
  outside this package.
- **Specialist sub-agents.** 50+ Markdown agent definitions under `agents/`, used by
  spine fan-out and `Task` dispatch.
- **Cross-platform Node utilities.** Hooks, lifecycle scripts, and helpers under
  `scripts/`. CommonJS only.
- **Domain-rule library.** Per-language rule sets under `rules/` (cpp, csharp, dart,
  golang, java, kotlin, perl, php, python, rust, swift, typescript, web, plus
  `common/` and `zh/`). The Karpathy behavioral rule lives at the repo root, not
  here.
- **MCP server configs.** `mcp-configs/mcp-servers.json` ships the curated MCP set.

## Rules for editing this package

- **CommonJS only.** All `scripts/` files use `require`/`module.exports`. No ESM
  unless the file is `.mjs`. No TypeScript here.
- **Cross-platform paths.** Always `path.join(...)` — never hardcoded `\` or `/`.
  Use `path.sep` for platform-aware splits.
- **Hooks must use `run-with-flags.js`.** Any new hook script must be invoked
  through `scripts/hooks/run-with-flags.js` so `ECC_HOOK_PROFILE` and
  `ECC_DISABLED_HOOKS` runtime gating still works. Pattern:
  `node scripts/hooks/run-with-flags.js <hook-id> scripts/hooks/<my-hook>.js standard,strict`.
- **Hooks export `run(rawInput, ctx)`.** New hooks should export a `run` function so
  the wrapper can `require()` them in-process (saves ~50–100 ms per fire). Hooks
  with side effects at module scope are legacy.
- **Hook scripts ≤ 200 lines.** Extract helpers into `scripts/lib/`.
- **Always exit 0 on parse / non-critical errors.** Hooks must never block tool
  execution unexpectedly. Log to stderr with a `[HookName]` prefix.
- **Blocking hooks (PreToolUse, Stop) stay fast.** Target < 200 ms. No network
  calls. Async hooks (`async: true` in `settings.json`) get a timeout ≤ 30 s.
- **Tests for everything.** New script in `scripts/lib/` → matching test in
  `tests/lib/`. New hook → integration test in `tests/hooks/`. Run
  `node tests/run-all.js` before committing.
- **Don't touch root files.** Root `package.json`, root `CLAUDE.md`,
  `pnpm-workspace.yaml`, and other packages are owned by their respective sub-agents.

## Adding a new specialist agent

Drop a Markdown file under `agents/` with YAML frontmatter:

```yaml
---
name: my-reviewer
description: One-line job description used at dispatch time.
tools: [Read, Grep, Bash]
model: sonnet
---
```

Body: when to invoke, what to focus on, what shape of report to return. Keep agents
narrow — one concern per agent.

## Adding a new hook

1. Author `scripts/hooks/<my-hook>.js` exporting `run(rawInput, ctx)`. Stay under
   200 lines; extract helpers to `scripts/lib/`.
2. Add a test in `tests/hooks/<my-hook>.test.js` driving the `run` export with
   crafted inputs. Cover happy path + at least one failure mode.
3. Wire it in a JSON spec under `hooks/` using the `run-with-flags.js` wrapper.
   Pick the right lifecycle event (PreToolUse / PostToolUse / Stop / etc.) and a
   tight matcher.
4. Run `node tests/run-all.js` to confirm green.

## Boil-the-Ocean — Layer 2 (active checkpoint)

`hooks/pre-tool-boil.json` is the active-checkpoint layer. Matcher
`Write|Edit|MultiEdit`. It runs `node ../../tools/boil-review.js --quick` (path is
relative to the repo root) through `run-with-flags.js` so the 10-section sweep
becomes runtime context before any write fires. The full sweep
(`tools/boil-review.js --full`) is invoked from the CI gate (Layer 3) — that's
owned by sub-agent J.

## Spine fan-out

Spine commands delegate to `tools/spine-fanout.js` (repo root, owned by sub-agent
I). `commands/*.md` here are thin — they declare phase, default specialist set, and
hand off. Don't grow command bodies; grow the agent registry instead.
