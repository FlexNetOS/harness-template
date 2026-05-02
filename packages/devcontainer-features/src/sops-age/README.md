# sops + age (`sops-age`)

Installs Mozilla [sops](https://github.com/getsops/sops) and
[FiloSottile/age](https://github.com/FiloSottile/age) into `/usr/local/bin`,
with SHA256 verification against pinned checksums.

## Example usage

```jsonc
{
  "features": {
    "ghcr.io/<owner>/devcontainer-features/sops-age:0": {
      "sopsVersion": "3.9.4",
      "ageVersion": "1.2.1"
    }
  }
}
```

## Options

| Option        | Type   | Default | Description                                              |
| ------------- | ------ | ------- | -------------------------------------------------------- |
| `sopsVersion` | string | `3.9.4` | Version of `getsops/sops` to install (no leading `v`).   |
| `ageVersion`  | string | `1.2.1` | Version of `FiloSottile/age` to install (no leading `v`).|

## Architecture detection

The feature detects the host arch via `dpkg --print-architecture` (preferred)
falling back to `uname -m`. Supported: `amd64` (x86_64), `arm64` (aarch64).

## Checksum policy

SHA256 sums are pinned in `install.sh` for the default `(version, arch)` pairs.
If you bump `sopsVersion` or `ageVersion` to a value not in the table, the
install logs a `TODO: pin checksum after publish` warning and proceeds
without verification — update `sha_for()` in `install.sh` to add the new pin.

## Verify

```bash
sops --version
age  --version
```
