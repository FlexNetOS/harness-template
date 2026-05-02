---
name: Bug report
about: Report a defect so we can fix it
title: "bug: <short summary>"
labels: [bug, triage]
assignees: []
---

<!--
Thanks for filing a bug! Please fill out every section. Bugs without a clear
reproduction get auto-closed during triage.

If this is a security issue, do NOT file it here — see SECURITY.md instead.
-->

## Reproduction

Steps to reproduce the behavior:

1. Run `harness-spawn ...`
2. Open `...`
3. Observe `...`

A minimal failing example, or a link to a public repo, dramatically speeds things up.

```bash
# paste the exact commands you ran
```

## Expected behavior

What you expected to happen.

## Actual behavior

What actually happened. Include logs, stack traces, or screenshots.

```text
<paste the error output here>
```

## Environment

- Harness template version / commit SHA:
- OS and version (e.g. macOS 14.5, Ubuntu 22.04, Windows 11):
- Node version (`node --version`):
- pnpm version (`pnpm --version`):
- Docker / devcontainer CLI version (if relevant):
- Shell:

## Additional context

Anything else we should know? Did this work in a previous version? Is it
intermittent? Have you tried `pnpm install --frozen-lockfile` and rebuilding
the devcontainer?
