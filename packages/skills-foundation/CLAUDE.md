# skills-foundation — Package Context

This package contains the foundation meta-skills (`/aw:wiki`, `/aw:delegate`, `/aw:implement`, `/aw:debug`, `/aw:agents-skills`). All commands here use the `/aw:` prefix to avoid colliding with the spine commands in `harness-core`.

## Origin

Vendored verbatim from the upstream [agents-workspace](https://github.com/wcgomes/agents-workspace) project. The behavioral rules in `AGENTS.md` and inside each `SKILL.md` are load-bearing — preserve them when updating.

## Layout

```
skills-foundation/
├── AGENTS.md            # Boot contract — specialist-first ruleset (verbatim from upstream)
├── README.md            # Package README (renamed from "agents-workspace" → "skills-foundation")
├── CLAUDE.md            # This file
├── package.json         # @harness-template/skills-foundation, private, no build step
├── tools/
│   └── install.sh       # Original installer (untouched)
├── skills/              # 5 meta-skills, folder names unchanged
│   ├── delegate/        # (/aw:delegate)
│   ├── wiki/            # (/aw:wiki)
│   ├── implement/       # (/aw:implement)
│   ├── debug/           # (/aw:debug)
│   └── agents-skills/   # (/aw:agents-skills)
└── tests/
    └── smoke.test.js    # Verifies all 5 skill folders exist and have a SKILL.md
```

## Namespace prefix renames

The upstream skills do not define explicit slash-command invocations inside their `SKILL.md` bodies — they activate via Claude's description-matching. To formalize the namespaced invocation aliases required by the harness-template plan and avoid collisions with `harness-core` spine commands, each skill's frontmatter has been augmented with a `command:` field:

| Skill folder | `name:` frontmatter | `command:` frontmatter (new) |
|---|---|---|
| `skills/wiki/` | `wiki` | `/aw:wiki` |
| `skills/delegate/` | `delegate` | `/aw:delegate` |
| `skills/implement/` | `implement` | `/aw:implement` |
| `skills/debug/` | `debug` | `/aw:debug` |
| `skills/agents-skills/` | `agents-skills` | `/aw:agents-skills` |

Skill `name:` values and folder names are unchanged from upstream so skill IDs remain unique and discovery still works against the original spec. Only the invocation alias is namespaced.

The README's command-table reflects the same prefixing.

## Build / test

This is a pure markdown skill pack. There is no build step.

```bash
pnpm --filter @harness-template/skills-foundation test
# or:
node --test tests/
```

The smoke test verifies the 5 expected skill folders exist and that each has a `SKILL.md`. It does NOT validate skill content — that is the responsibility of the agent runtime.

## When updating

- Treat `AGENTS.md` as load-bearing — do not rewrite specialist-first language.
- When upstream `agents-workspace` ships changes, re-vendor under this subtree, then re-apply the `command:` frontmatter additions and the README name swap.
- Do not introduce new skills here without an `/aw:` command alias.
