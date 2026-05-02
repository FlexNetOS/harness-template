# `.devcontainer/` — harness-template turnkey shell

This directory ships a VS Code / Codespaces devcontainer that gives you, in one
"Reopen in Container" click, a Linux shell with:

- **Three AI CLIs on `PATH`** — `claude`, `codex`, `gemini`.
- **`sops` + `age`** (pinned, checksum-verified from upstream releases) for
  decrypting `.env.sops` directly into your shell environment — never to disk.
- **`pnpm@9.12.0`** for the workspace install.
- **`python3` / `pip` / `git` / `curl` / `jq` / `gnupg`** baseline plumbing.

Port `5432` is forwarded so spawned templates that bring up a Postgres can be
reached from your host browser/tools.

## Files

| File | Role |
|------|------|
| `Dockerfile` | Image definition. Pinned versions for sops, age, and pnpm. |
| `devcontainer.json` | VS Code devcontainer config: build, mounts, postCreate, extensions. |
| `post-create.sh` | One-time bootstrap: age key, decrypt secrets, `pnpm install`, smoke-test, print auth instructions. |
| `README.md` | This file. |

## How it works

1. **Build** — VS Code builds the image from `Dockerfile`.
2. **Mount your age key** — `devcontainer.json` bind-mounts
   `~/.config/sops/age/keys.txt` from your host (read-only) to the same path
   in the container, so SOPS can decrypt without copying private keys around.
3. **postCreate** — `post-create.sh` runs once and:
   - generates an age key if you don't have one (and prints the public key
     plus backup instructions),
   - decrypts `.env.sops` (if present) into the post-create shell — secrets
     are never written to a `.env` file on disk,
   - runs `pnpm install`,
   - smoke-tests each CLI,
   - prints per-CLI auth instructions.

## Loading secrets into your interactive shell

`post-create.sh` decrypts `.env.sops` only into its own process. To get those
secrets in every new terminal you open, add the following to `~/.bashrc`
inside the container (one-time):

```bash
if [ -f /workspaces/harness-template/.env.sops ]; then
  eval "$(sops -d --output-type dotenv /workspaces/harness-template/.env.sops 2>/dev/null | sed 's/^/export /')"
fi
```

This keeps the secrets in-memory only — no `.env` file ever touches disk.

## Why we don't auto-auth Codex / Gemini

`@anthropic-ai/claude-code` reads `ANTHROPIC_API_KEY` from the environment, so
`.env.sops` is enough. The other two are different:

- **Codex** prefers a device-code login (`codex login`) that writes a token
  bound to your machine. We can't run that for you because it requires a
  browser hand-off.
- **Gemini** can use either `GOOGLE_API_KEY` *or* an interactive `gemini auth`
  (depending on the build). If your team uses Workspace SSO, the env-var path
  often won't work and you must do the interactive login.

In both cases, automating it inside the image would either fail silently or
embed credentials where they don't belong. The post-create script prints the
exact next step for each CLI instead.

## Extending the devcontainer

- **Adding a tool**: add the install line to `Dockerfile`. Pin the version
  and verify a checksum where the upstream provides one.
- **Adding a VS Code extension**: append to
  `customizations.vscode.extensions` in `devcontainer.json`.
- **Adding a port forward**: add to `forwardPorts` in `devcontainer.json`.
- **Adding a postCreate step**: append to `post-create.sh`. Keep it
  idempotent — re-running the script must be safe.
- **Pinning a different sops/age version**: update `SOPS_VERSION` /
  `AGE_VERSION` (and the matching `*_AMD64_SHA256`) build-args in
  `Dockerfile`. Get checksums from the GitHub release page.

## Gemini CLI fallback

If `npm i -g @google/gemini-cli` ever stops resolving (the package has
churned), the Dockerfile logs a warning rather than failing the build. Use
the upstream repo directly:

```bash
npx https://github.com/google-gemini/gemini-cli --version
```

You can also alias it in `~/.bashrc`:

```bash
alias gemini='npx https://github.com/google-gemini/gemini-cli'
```
