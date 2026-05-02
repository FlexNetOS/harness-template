# @harness-template/core

The runtime heart of the harness: spine-command Markdown, always-on hooks,
specialist sub-agents, cross-platform Node utilities, and per-language rule sets.

## Structure

```
packages/harness-core/
├── agents/           50+ specialist sub-agent Markdown definitions
├── commands/         spine commands + auxiliary slash commands
├── hooks/            JSON hook specs (PreToolUse, PostToolUse, Stop, …)
├── mcp-configs/      curated MCP server set
├── rules/            per-language domain rules (cpp, py, ts, rust, …)
├── scripts/          Node utilities (CommonJS)
│   ├── hooks/        hook implementations + run-with-flags.js wrapper
│   └── lib/          shared helpers
├── tests/            Node test runner (`node tests/run-all.js`)
├── package.json
├── CLAUDE.md         per-package context for Claude
└── README.md         this file
```

## Running tests

From the package root:

```bash
node tests/run-all.js
```

From the monorepo root:

```bash
pnpm --filter @harness-template/core test
```

Tests live alongside the code they exercise:

- `tests/lib/*.test.js` for `scripts/lib/`
- `tests/hooks/*.test.js` for `scripts/hooks/`
- `tests/scripts/*.test.js` for top-level `scripts/`

Every new file under `scripts/` should ship with a matching test in the same
commit. No "tests later."

## Adding an agent

Create a new Markdown file under `agents/`:

```markdown
---
name: my-reviewer
description: One-line job description used at dispatch time.
tools: [Read, Grep, Bash]
model: sonnet
---

# my-reviewer

When to invoke …
What to focus on …
Shape of report to return …
```

Keep each agent narrow. One concern per file. File names are lowercase
hyphenated (`security-reviewer.md`, not `SecurityReviewer.md`).

## Adding a hook

1. **Author the hook script.** `scripts/hooks/<my-hook>.js` should export
   `run(rawInput, ctx)`:

   ```js
   'use strict';

   function run(rawInput, ctx) {
     // …decide what to do…
     return { stdout: rawInput, stderr: '', exitCode: 0 };
   }

   module.exports = { run };
   ```

   Stay under 200 lines. Extract helpers to `scripts/lib/`. Always exit 0 on
   parse / non-critical errors — hooks must never block tool execution
   unexpectedly.

2. **Test it.** `tests/hooks/<my-hook>.test.js` drives the `run` export with
   crafted inputs. Cover happy path + at least one failure mode.

3. **Wire it via JSON.** Add an entry to `hooks/hooks.json` (or a dedicated
   `hooks/<area>.json`) using the `run-with-flags.js` wrapper:

   ```json
   {
     "matcher": "Write|Edit|MultiEdit",
     "hooks": [
       {
         "type": "command",
         "command": "node scripts/hooks/run-with-flags.js my-hook scripts/hooks/my-hook.js standard,strict",
         "timeout": 5
       }
     ],
     "id": "pre:my-hook"
   }
   ```

4. **Run the tests:** `node tests/run-all.js`.

## Hook lifecycle quick-reference

| Event | Use for | Latency budget |
|---|---|---|
| `PreToolUse` | Block, gate, or inject context | < 200 ms (blocking) |
| `PostToolUse` | Logging, accumulators, async work | up to 30 s with `async: true` |
| `PostToolUseFailure` | Failure tracking, recovery | < 30 s |
| `Stop` | Batch format / typecheck / notify | up to 5 min |
| `SessionStart` / `SessionEnd` | Bootstrap / persist | < 30 s |

## Boil-the-Ocean — Layer 2

`hooks/pre-tool-boil.json` wires the active-checkpoint sweep before every
`Write|Edit|MultiEdit`. It calls `node ../../tools/boil-review.js --quick`
(path relative to the repo root) through `run-with-flags.js` so the 10-section
checklist becomes context before the tool fires.

Layer 1 (always-on framing) lives in the root `CLAUDE.md`. Layer 3 (terminal
CI gate) lives in `.github/workflows/boil-review.yml`. Layer 2 lives here.

## Conventions

- **CommonJS only** in `scripts/`.
- **Cross-platform paths.** Always `path.join(...)`.
- **Lowercase-hyphen filenames** everywhere.
- **Test files named `*.test.js`** so the runner picks them up automatically.

See `CLAUDE.md` in this directory for the full per-package rule set.
