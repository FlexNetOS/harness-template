# node-postgres-claude

Reference Node.js + Postgres + Claude-CLI service spawned from
[`harness-template`](https://github.com/FlexNetOS/harness-template).

A minimal-but-real Express app on Postgres, with the Claude CLI baked into the
devcontainer, SOPS-encrypted secrets, and a working `/health` endpoint plus
tests. It is meant to be the starting point for a real service — not a toy.

---

## Quickstart

### Prerequisites

- Docker Desktop (Windows/macOS) or Docker + Compose v2 (Linux).
- VS Code with the **Dev Containers** extension, OR another devcontainer-aware
  editor (Cursor, JetBrains Gateway, etc.).
- An [age](https://github.com/FiloSottile/age) keypair on your host at
  `~/.config/sops/age/keys.txt`. If you don't have one, the post-create script
  will generate one for you on first boot.

### 1. Open in the devcontainer

```bash
git clone <your-fork-url> my-service
cd my-service
code .
# When prompted: "Reopen in Container"
```

The devcontainer build will:

1. Build the app image (Node 20, sops, age, pnpm, Claude CLI).
2. Start a Postgres 16 sidecar.
3. Run `.devcontainer/post-create.sh`, which:
   - Verifies/creates your age key.
   - Decrypts `.env.sops` into the post-create shell.
   - Smoke-tests the Claude CLI.
   - `pnpm install`.
   - Waits for Postgres, runs `pnpm migrate`.

### 2. Configure secrets

The shipped `.env.sops` is a placeholder. Replace it:

```bash
# Get your age public key
grep '^# public key:' ~/.config/sops/age/keys.txt

# Edit .sops.yaml — replace the `age1placeholder...` recipient with YOUR key.

# Create a real .env.sops:
sops .env.sops    # Opens an editor; populate DATABASE_URL, ANTHROPIC_API_KEY, PORT.
```

For local dev without SOPS, copy `.env.example` to `.env` (gitignored).

### 3. Run it

```bash
pnpm dev                         # hot-reload server on :3000
curl http://localhost:3000/health
# => {"status":"ok","db":"ok","timestamp":"..."}
```

### 4. Test it

```bash
pnpm test
```

---

## Layout

```
.
├── .devcontainer/         # Devcontainer image + post-create bootstrap
│   ├── Dockerfile
│   ├── devcontainer.json
│   └── post-create.sh
├── docker-compose.yml     # app + postgres services
├── src/
│   ├── app.ts             # buildApp() — exported for tests
│   ├── index.ts           # Boot
│   └── db/
│       ├── client.ts      # Drizzle pool + pingDb()
│       ├── schema.ts      # Tables (users sample)
│       └── migrate.ts     # Migration runner
├── tests/
│   └── health.test.ts     # /health contract
├── drizzle.config.ts
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── .sops.yaml             # Encryption rules (replace age recipient!)
├── .env.sops              # Encrypted secrets (placeholder — re-create)
├── .env.example           # Local-dev template
├── CLAUDE.md              # Operating standard for AI agents in this project
└── README.md              # You are here
```

---

## Common tasks

| Task | Command |
|---|---|
| Run dev server | `pnpm dev` |
| Run tests | `pnpm test` |
| Generate a migration after schema edits | `pnpm migrate:generate` |
| Apply pending migrations | `pnpm migrate` |
| Build for production | `pnpm build` |
| Run production build | `pnpm start` |
| Type-check only | `pnpm typecheck` |
| Open Postgres CLI | `docker compose exec postgres psql -U postgres -d app` |

---

## Adding a new endpoint

1. Add the route inside `buildApp()` in `src/app.ts`.
2. If it touches a new table, edit `src/db/schema.ts`, then
   `pnpm migrate:generate && pnpm migrate`.
3. Write a test in `tests/`. See `tests/health.test.ts` for the mock pattern.
4. `pnpm test` must be green before commit.

## Adding a new dependency

```bash
pnpm add <pkg>          # runtime
pnpm add -D <pkg>       # dev
```

The devcontainer rebuilds automatically pick up `package.json` changes. Inside a
running container just rerun `pnpm install`.

---

## CI / production notes

- The `app` service in `docker-compose.yml` is sized for development. For prod,
  build the image from `.devcontainer/Dockerfile` (or write a slimmer
  `Dockerfile.prod`) and run `pnpm build && pnpm start`.
- Inject `DATABASE_URL` and `ANTHROPIC_API_KEY` from your secret store. Do
  **not** ship `.env.sops` to prod — decrypt it at deploy time and load into
  the runtime environment.
- The `/health` endpoint returns 503 when the DB is unreachable — wire it up to
  your orchestrator's liveness probe.

---

## License

MIT (or whatever the spawner injects on `degit`).
