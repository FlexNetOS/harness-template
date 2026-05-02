# Contributing

Thanks for considering a contribution. This repository follows the **Boil-the-Ocean**
standard: every PR ships **code + tests + docs** in the same change. No half-done
features, no "TODO: tests later," no dangling threads.

## Development setup

1. Clone the repo.
2. Generate your age keypair: `age-keygen -o ~/.config/sops/age/keys.txt`.
3. Send your **public** key to a maintainer for inclusion in `.sops.yaml`.
4. Open in VS Code → "Reopen in Container."
5. Inside the container: `pnpm install` (auto-runs via `post-create.sh`).
6. Verify: `pnpm verify`.

## PR checklist

Every PR must:

- [ ] Pass `pnpm verify` locally (collisions check + tests + full boil-review).
- [ ] Include tests for any new code.
- [ ] Update relevant `docs/<X>.md` if behavior or interfaces change.
- [ ] Use a Conventional Commit prefix in the title (`feat:`, `fix:`, `docs:`, `test:`, etc.).
- [ ] Pass the `boil-review.yml` CI gate (full 10-section review).

## Code conventions

- **Node.js >= 20**, CommonJS in `tools/` and `scripts/` (`require`/`module.exports`).
  TypeScript allowed in package source code (`packages/*/src/`) only when there's a
  build step.
- **File naming**: lowercase with hyphens (`pre-tool-boil.json`, `spine-fanout.js`).
- **Cross-platform**: scripts must run on macOS, Linux, and Windows. CI matrix
  enforces this.
- **No `--no-verify`** unless explicitly authorized in the PR description.
- **Conventional Commits** required (Commitlint enforced via hook).

## Slash-command policy

Adding a new top-level command? It must hang off the spine or live as a `/aw:*`
auxiliary or in `packages/skills-software-factory/`. The collision gate
(`tools/check-command-collisions.js`) will reject duplicates against the spine.

## Reporting bugs

Use the GitHub issue templates in `.github/ISSUE_TEMPLATE/`.

## Security

See [SECURITY.md](SECURITY.md). Do not file security issues publicly.
