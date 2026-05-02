# harness-template

> An OSS-grade Claude Code harness + devcontainer template, organized around a unified
> slash-command pipeline (`/think → /plan → /code → /review → /test → /ship → /reflect`)
> with multi-Claude fan-out per phase. Boil-the-Ocean is mechanically enforced.

## What this is

A turnkey devcontainer that ships:

- **Three AI CLIs preinstalled**: Claude Code (`@anthropic-ai/claude-code`),
  Codex (`@openai/codex`), Gemini (`@google/gemini-cli`).
- **Vault-streamed secrets** via `sops + age` — `.env` is never written to disk.
- **Unified slash-command spine** for end-to-end software delivery.
- **Multi-Claude orchestration** built into every spine command (parallel specialist sub-agents).
- **Boil-the-Ocean injection** wired at three layers (always-on, active checkpoint, CI gate).
- **Karpathy coding-behavior rule** always-on.
- **Project spawner** (`harness-spawn`) for instantiating the template into a new project.

## 5-minute quickstart

```bash
# 1. Clone
git clone https://github.com/FlexNetOS/harness-template
cd harness-template

# 2. Generate your age keypair (one-time per contributor)
age-keygen -o ~/.config/sops/age/keys.txt
# Send the public key (printed) to the maintainer for inclusion in .sops.yaml

# 3. Open in VS Code (or Cursor, etc.) and "Reopen in Container"
code .

# 4. Inside the devcontainer:
claude --version    # smoke-test
codex --version
gemini --version

# 5. Run a spine command
claude
> /think "What should we build next?"
```

## The slash-command spine

```
┌─────────┐   ┌─────────┐   ┌─────────┐   ┌─────────┐   ┌─────────┐   ┌─────────┐   ┌──────────┐
│ /think  │──▶│ /plan   │──▶│ /code   │──▶│ /review │──▶│ /test   │──▶│ /ship   │──▶│ /reflect │
└─────────┘   └─────────┘   └─────────┘   └─────────┘   └─────────┘   └─────────┘   └──────────┘
   ↑              ↑              ↑              ↑              ↑              ↑              ↑
  divergent     design        implement     critique       verify        deliver         learn
```

Each command spawns specialist sub-agents in parallel. See [docs/SPINE.md](docs/SPINE.md)
and [docs/MULTI-CLAUDE.md](docs/MULTI-CLAUDE.md).

## Spawn a new project from this template

```bash
pnpm dlx harness-template-spawn node-postgres-claude my-app
cd my-app
code .   # "Reopen in Container" — Boil-the-Ocean injection is live in the spawned project
```

See [docs/SPAWNER.md](docs/SPAWNER.md).

## Documentation

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — overall design
- [docs/SPINE.md](docs/SPINE.md) — the seven spine commands
- [docs/MULTI-CLAUDE.md](docs/MULTI-CLAUDE.md) — fan-out pattern, agent SDK usage
- [docs/BOIL-THE-OCEAN.md](docs/BOIL-THE-OCEAN.md) — three-layer injection
- [docs/SPAWNER.md](docs/SPAWNER.md) — `harness-spawn` CLI
- [docs/VAULT.md](docs/VAULT.md) — sops + age workflow
- [docs/CLI-AUTH.md](docs/CLI-AUTH.md) — Claude / Codex / Gemini auth flows

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). All PRs must pass `pnpm verify` (collisions
check + tests + full Boil-the-Ocean review). Conventional Commits required.

## License

MIT — see [LICENSE](LICENSE).

## Security

Vulnerability disclosure: [SECURITY.md](SECURITY.md).
