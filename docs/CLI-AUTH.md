# CLI Auth — Claude, Codex, Gemini

> How each AI CLI authenticates inside a spawned project. This is
> *runtime auth* — for *secret-at-rest* management (sops + age), see
> [VAULT.md](./VAULT.md). For the multi-CLI spine that consumes these
> credentials, see [MULTI-CLAUDE.md](./MULTI-CLAUDE.md).

## Design principles

1. **Never bake credentials into the Dockerfile.** The devcontainer
   image is shared across team members and may be cached on shared CI
   runners. API keys would leak.
2. **Prefer interactive OAuth where the CLI supports it.** OAuth tokens
   are scoped, revokable, and tied to a real human identity. API keys
   are not.
3. **Fall back to env-var API keys** for CI and for CLIs that don't
   offer OAuth. Inject them at runtime, never at build time.
4. **Document where to get each credential.** The single most common
   onboarding question is "where do I click?"

## Claude

### How it auths

Claude (the `claude` CLI / Claude Code) reads `ANTHROPIC_API_KEY` from
the environment. There is no interactive OAuth flow on the CLI side
today.

### Where to get the key

1. Sign in at https://console.anthropic.com/.
2. Go to **Settings -> API Keys -> Create Key**.
3. Copy the key (starts with `sk-ant-`).

### How to inject it

For local dev, put it in your shell rc:

```bash
# ~/.zshrc or ~/.bashrc
export ANTHROPIC_API_KEY="sk-ant-..."
```

For the devcontainer, add it to your **personal** `~/.devcontainer.env`
and mount it (the spawner's `.devcontainer/devcontainer.json` already
declares the mount). **Do not commit** the env file.

For CI, set it as a repo secret named `ANTHROPIC_API_KEY` and reference
it in workflows. (The workflows in this repo do not invoke Claude
directly — they only run static checks.)

### Free-tier limits

Anthropic offers free credits to new accounts; after that, usage is
metered per million input/output tokens. Keep an eye on the **Usage**
page in console.anthropic.com. Rate limits also apply per-minute and
per-day; the Claude Agent SDK exposes `429 Too Many Requests` if you
exceed them. See:
https://docs.anthropic.com/en/api/rate-limits

## Codex

### How it auths

Codex (OpenAI's CLI) supports two modes, in order of preference:

1. **`codex login`** — interactive OAuth. Opens a browser, you sign in,
   the CLI stores a token under `~/.codex/auth.json`. This is the
   recommended path for human developers.
2. **`OPENAI_API_KEY` env var** — fallback for CI and headless
   environments. The CLI will use the env var if no `auth.json` exists.

### Where to get it

- **OAuth:** Just run `codex login` and follow the prompts. You need
  an OpenAI account at https://platform.openai.com/.
- **API key:** https://platform.openai.com/api-keys -> **Create new
  secret key**. Starts with `sk-`.

OpenAI's CLI auth docs:
https://platform.openai.com/docs/guides/authentication

### How to inject it

For local dev (interactive):

```bash
codex login   # one-time, opens browser
```

For CI (env var):

```yaml
env:
  OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
```

### Why we don't auto-auth Codex in the Dockerfile

`codex login` opens a browser and writes to `~/.codex/auth.json`. In
a Dockerfile this would either fail (no browser) or leak credentials
into the image layer. We deliberately skip it. Inside the
devcontainer, the spawner mounts `~/.codex` from the host so a single
`codex login` on your laptop works in every container.

## Gemini

### How it auths

The `gemini` CLI also supports two modes:

1. **`gemini auth`** — interactive Google OAuth. Stores credentials
   under `~/.config/gemini/`.
2. **`GOOGLE_API_KEY` env var** — API-key fallback.

### Where to get it

- **OAuth:** `gemini auth login` (browser-based).
- **API key:** Google AI Studio at https://aistudio.google.com/app/apikey
  — click **Create API key**.

Google AI Studio docs:
https://ai.google.dev/gemini-api/docs/api-key

### How to inject it

Local dev (interactive):

```bash
gemini auth login   # one-time
```

CI:

```yaml
env:
  GOOGLE_API_KEY: ${{ secrets.GOOGLE_API_KEY }}
```

### Why we don't auto-auth Gemini in the Dockerfile

Same reason as Codex. The OAuth flow needs a browser; the API-key
flow would mean baking a credential into a shared image. The
devcontainer mounts `~/.config/gemini` from the host so one login on
your laptop covers all containers.

## Quick reference

| CLI    | Interactive             | Env-var fallback   | Where to click                                              |
| ------ | ----------------------- | ------------------ | ----------------------------------------------------------- |
| Claude | (none)                  | `ANTHROPIC_API_KEY`| https://console.anthropic.com/                              |
| Codex  | `codex login`           | `OPENAI_API_KEY`   | https://platform.openai.com/api-keys                        |
| Gemini | `gemini auth login`     | `GOOGLE_API_KEY`   | https://aistudio.google.com/app/apikey                      |

## Troubleshooting

**"401 Unauthorized" from Claude:** the API key is missing, mistyped,
or revoked. Print `echo "${ANTHROPIC_API_KEY:0:10}..."` (just the
prefix!) to confirm it's loaded.

**"codex: not logged in" inside the devcontainer:** the host-side
`~/.codex` mount didn't pick up. Run `codex login` *inside* the
container to re-auth, or check the mount in
`.devcontainer/devcontainer.json`.

**Gemini quota errors:** Google AI Studio has free-tier quotas per
minute and per day. The error response includes the retry-after
window; the spine-fanout dispatcher honors it automatically.

## Cross-references

- Secret-at-rest workflow (sops + age): [VAULT.md](./VAULT.md)
- Multi-CLI orchestration that uses these credentials: [MULTI-CLAUDE.md](./MULTI-CLAUDE.md)
- Repo architecture: [ARCHITECTURE.md](./ARCHITECTURE.md)
- Spawner CLI options for which CLIs to install: [SPAWNER.md](./SPAWNER.md)
- Top-level security policy: [../SECURITY.md](../SECURITY.md)
