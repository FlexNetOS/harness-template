# Vault — secret management with sops + age

> How we handle secrets in this template and in every project the
> spawner produces. For the bigger picture, see
> [ARCHITECTURE.md](./ARCHITECTURE.md). For per-CLI API-key handling
> (which is auth, not secrets-at-rest), see [CLI-AUTH.md](./CLI-AUTH.md).

## TL;DR

- Secrets are stored **encrypted-at-rest in git**, in `*.sops.yaml` files.
- We encrypt with [sops](https://github.com/getsops/sops) using
  [age](https://github.com/FiloSottile/age) recipients (one per developer).
- Each developer holds a private age key in `~/.config/sops/age/keys.txt`.
- To grant access, a maintainer adds the developer's **public** key to
  `.sops.yaml` and re-encrypts the secrets.
- Compromise = rotate immediately. There is a runbook below.

## Why sops + age (and not Vault, Doppler, etc.)

- **Git-native.** Diffable, reviewable, branchable. PR flow works.
- **Offline-capable.** No service to depend on at build time.
- **Per-recipient access.** Adding a new developer is a config change,
  not a credential reset.
- **Kept in source control.** Lost laptops do not lose the data, only the key.

For services and humans that need *runtime* secrets (e.g. a deployed
API), pair this with a real secret store. Sops + age is the
*authoring* and *team-sharing* layer; production reads from your
platform's secret manager.

## One-time setup

### 1. Install the tools

```bash
# macOS
brew install sops age

# Ubuntu / Debian
sudo apt-get install age
curl -sSL -o /tmp/sops.deb \
  https://github.com/getsops/sops/releases/latest/download/sops_amd64.deb
sudo dpkg -i /tmp/sops.deb

# Windows
winget install FiloSottile.age
winget install Mozilla.SOPS
```

### 2. Generate your age key

```bash
mkdir -p ~/.config/sops/age
age-keygen -o ~/.config/sops/age/keys.txt
```

The file contains both the **private** key and a comment with the
**public** key (an `age1...` string). Print the public key:

```bash
grep '# public key:' ~/.config/sops/age/keys.txt
```

### 3. Lock down filesystem permissions

The private key is the entire game. **Use OS-level filesystem
permissions** to keep it readable only by you:

```bash
# macOS / Linux
chmod 600 ~/.config/sops/age/keys.txt
chmod 700 ~/.config/sops/age

# Windows (PowerShell, run as your user)
icacls "$env:USERPROFILE\.config\sops\age\keys.txt" /inheritance:r
icacls "$env:USERPROFILE\.config\sops\age\keys.txt" /grant:r "$env:USERNAME:F"
```

Do *not* sync this file to cloud storage. Do *not* paste it into chat.
Treat it like an SSH private key.

### 4. Ask a maintainer to add you

Send your **public** key (the `age1...` string only) to a maintainer.
They will:

1. Add it to `.sops.yaml` under `creation_rules[*].age`.
2. Run `pnpm vault:rekey` (which calls `sops updatekeys` on every
   `*.sops.yaml`).
3. Commit and push.

You can now decrypt secrets:

```bash
sops -d secrets/prod.sops.yaml
```

## Day-to-day workflows

### Encrypting a new secret file

```bash
# Create plaintext
cat > /tmp/new-secret.yaml <<'YAML'
stripe:
  api_key: sk_live_xxx
YAML

# Encrypt in place. .sops.yaml's creation_rules pick recipients.
sops -e /tmp/new-secret.yaml > secrets/stripe.sops.yaml
rm /tmp/new-secret.yaml

git add secrets/stripe.sops.yaml
git commit -m "chore(secrets): add stripe credentials"
```

### Editing an existing secret

```bash
sops secrets/prod.sops.yaml   # opens $EDITOR with decrypted content
# save and quit -> sops re-encrypts on close
```

### Reading a secret in a script

```bash
# Programmatic decrypt (does not write plaintext to disk)
sops -d secrets/prod.sops.yaml | yq '.stripe.api_key'
```

In CI, set `SOPS_AGE_KEY` from a secret instead of relying on the
keyfile path:

```yaml
- run: pnpm vault:read prod stripe.api_key
  env:
    SOPS_AGE_KEY: ${{ secrets.SOPS_AGE_KEY }}
```

### Rotating recipients (offboarding)

When someone leaves the team:

1. Remove their public key from `.sops.yaml`.
2. Run `pnpm vault:rekey`.
3. Commit and push.
4. **Rotate the underlying secrets themselves.** `updatekeys` only
   removes future read access; the old recipient may have copied the
   plaintext. Anything they could decrypt before now must be assumed
   compromised — see the next section.

### Rotating an age key (your own)

If you simply want a new key (annual rotation, machine swap):

```bash
# 1. Generate a new key alongside the old one
age-keygen -o ~/.config/sops/age/keys.new.txt

# 2. Send the NEW public key to a maintainer; they add it.
# 3. Wait for `pnpm vault:rekey` to land on main.
# 4. Verify you can decrypt with the new key:
SOPS_AGE_KEY_FILE=~/.config/sops/age/keys.new.txt sops -d secrets/prod.sops.yaml

# 5. Replace the old keyfile.
mv ~/.config/sops/age/keys.new.txt ~/.config/sops/age/keys.txt

# 6. Have the maintainer remove your old public key from .sops.yaml and rekey again.
```

## What to do if your key is compromised

Treat it as a security incident:

1. **Stop using the keyfile immediately.** Do not push, pull, or decrypt.
2. **Notify a maintainer.** Out-of-band (Slack DM, phone) — not in a public channel.
3. **Generate a new age key.** (`age-keygen -o ~/.config/sops/age/keys.txt`,
   overwriting the old one.)
4. **Maintainer removes your old public key from `.sops.yaml` and runs
   `pnpm vault:rekey`.** This stops future decrypts using the leaked key.
5. **Rotate every secret the leaked key could decrypt.** Anything in
   `secrets/` at the time of compromise is assumed exposed:
   - API keys: revoke and reissue with the upstream provider.
   - Database credentials: rotate.
   - Third-party tokens: rotate.
6. **Audit access logs** for the rotated credentials in case the
   attacker already used them.
7. **File a postmortem in `docs/incidents/`** (or wherever this project
   keeps them) describing root cause and prevention.

## Cross-references

- Repo design: [ARCHITECTURE.md](./ARCHITECTURE.md)
- API-key auth (different problem!): [CLI-AUTH.md](./CLI-AUTH.md)
- Spawner-generated `.sops.yaml`: [SPAWNER.md](./SPAWNER.md)
- Top-level security policy: [../SECURITY.md](../SECURITY.md)
- Tooling source: `packages/vault-tools/`
