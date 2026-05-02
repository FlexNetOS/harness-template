# CLAUDE.md — node-postgres-claude

This file is loaded into every Claude conversation in this project. It establishes
the always-on operating standard for work in this codebase. This project was
spawned from `harness-template`, but is now standalone — no harness root context
is assumed.

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

---

## PROJECT OVERVIEW

A minimal but production-shaped Node.js + Postgres + Claude-CLI service.

- **Runtime**: Node.js 20+ (ESM, TypeScript via `tsx` in dev, `tsc` for build).
- **Web framework**: Express 4.
- **DB**: Postgres 16 (via docker-compose).
- **ORM**: Drizzle.
- **Tests**: Vitest + Supertest.
- **Secrets**: SOPS + age. `.env.sops` is the source of truth. `.env` is for
  local dev only and is gitignored.
- **Dev environment**: VS Code Dev Containers + docker-compose.

### Key files

| Path | Purpose |
|---|---|
| `src/index.ts` | Boot: builds the app and listens. |
| `src/app.ts` | `buildApp()` returns an Express instance — import this in tests. |
| `src/db/client.ts` | Drizzle pool + `pingDb()` health probe. |
| `src/db/schema.ts` | Drizzle table definitions. |
| `src/db/migrate.ts` | Applies migrations from `./drizzle`. |
| `tests/health.test.ts` | `/health` endpoint contract. |
| `docker-compose.yml` | `app` + `postgres` services. |
| `.devcontainer/` | Devcontainer config + post-create bootstrap. |
| `.sops.yaml`, `.env.sops`, `.env.example` | Secret management. |

---

## RULES OF ENGAGEMENT

### Code

- TypeScript strict mode is on. Don't disable it; fix the type.
- ESM only. Use `.js` extensions in import paths (TS rewrites them).
- No `any`. If you reach for it, stop and reconsider.
- Errors are values. Catch them at the seam (the route handler), log structurally,
  return a meaningful HTTP status.

### Database

- All schema changes go through Drizzle. Never edit migration SQL by hand.
- Workflow: edit `src/db/schema.ts` → `pnpm migrate:generate` → `pnpm migrate`.
- New tables ship with at least one test that reads/writes a row.

### Tests

- Every route has a test. `/health` is the floor, not the ceiling.
- DB-touching tests must work in CI without a live Postgres — mock the client
  module like `tests/health.test.ts` does, OR use a docker-compose Postgres in CI.
- Run `pnpm test` before declaring done. Green or it doesn't ship.

### Secrets

- Real secrets live ONLY in `.env.sops` (encrypted at rest with age).
- `.env` is for local-dev convenience and is in `.gitignore`. Don't commit it.
- Never log a secret. Never `console.log(process.env)`.
- The Claude CLI in the devcontainer reads `ANTHROPIC_API_KEY` from your shell
  env — load it via `eval "$(sops -d --output-type dotenv .env.sops | sed 's/^/export /')"`.

### Commits

- Conventional commits: `feat:`, `fix:`, `test:`, `docs:`, `refactor:`, `chore:`.
- Each commit should leave the tree green (`pnpm test` passes).

---

## COMMON COMMANDS

```bash
# Boot everything (devcontainer handles this on first open)
docker compose up -d

# Run the app in dev mode (hot reload)
pnpm dev

# Generate + apply migrations after editing src/db/schema.ts
pnpm migrate:generate
pnpm migrate

# Tests
pnpm test               # one-shot
pnpm test:watch         # interactive

# Build for production
pnpm build && pnpm start

# Health-check the running app
curl http://localhost:3000/health
```

---

## AGENT EXPECTATIONS

- When asked for a feature, deliver: the route, the schema change, the migration,
  the test, the docstring, the README update. All of it. One pass.
- Search the codebase before writing new files. Reuse `buildApp()`, `pingDb()`,
  the existing schema patterns.
- If a tool/dep is missing, install it and update `package.json`. Don't punt.
- Output the finished product, not a plan to build it.
