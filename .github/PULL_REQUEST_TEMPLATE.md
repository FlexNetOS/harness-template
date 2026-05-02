<!--
This PR template enforces the Boil-the-Ocean standard. Every PR ships
code + tests + docs together. Half-done is not OK.
-->

## What changed

<!-- Brief description of the change. Why does this exist? -->

## Boil-the-Ocean checklist

- [ ] Code is complete (no TODO/FIXME stubs left in the diff)
- [ ] Tests added/updated and passing locally (`pnpm test`)
- [ ] Docs added/updated (`docs/<X>.md` and/or README)
- [ ] No workarounds where the real fix exists
- [ ] No dangling threads (loose ends sealed in this PR or filed as issues)
- [ ] Cross-platform safe (Mac/Linux/Windows-aware paths and scripts)
- [ ] Conventional Commit title (`feat:` / `fix:` / `docs:` / `test:` / etc.)

## Verification

- [ ] `pnpm verify` passes locally
- [ ] CI matrix green (macOS, Linux, Windows)
- [ ] `boil-review.yml` 10-section sweep passes

## Related

<!-- Issue / spec / discussion links -->
