# Security Policy

## Reporting a vulnerability

Please **do not** open a public GitHub issue for security reports.

Instead, email: **revenaugh.david@gmail.com** with subject line `SECURITY: harness-template`.

Include:
- A clear description of the vulnerability
- Reproduction steps or proof-of-concept
- Affected version(s) / commit SHA(s)
- Your assessment of severity and impact
- Any suggested mitigations

We will acknowledge receipt within 72 hours and aim to provide a remediation
timeline within 7 days.

## Supported versions

| Version | Supported          |
|---------|--------------------|
| 0.1.x   | :white_check_mark: |
| < 0.1.0 | :x:                |

## Security model

- **Secrets** are stored encrypted in `.env.sops` and decrypted at runtime via
  `sops -d`. Plaintext `.env` is never written to disk inside the devcontainer.
- **Three-CLI auth keys** (Anthropic, OpenAI, Google) are sourced from the
  decrypted env at boot. Keys are never logged.
- **Devcontainer features** are published to GHCR with provenance attestations.
- **PRs** are gated by `boil-review.yml`, which runs the full 10-section Boil-the-Ocean
  review and surfaces any security gaps before merge.

## Known limitations

- The age private key is stored in cleartext at `~/.config/sops/age/keys.txt`.
  Protect that file with OS-level filesystem permissions; treat it like an SSH
  private key.
- Codex and Gemini CLIs may persist OAuth tokens in their respective config
  directories (`~/.codex/`, `~/.config/gemini/`). These are not encrypted by default.
