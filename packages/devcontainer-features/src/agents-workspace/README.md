
# Agents Workspace (agents-workspace)

AI agent workspace with specialist agents for orchestrated, minimal, and self-learning workflows.

## Example Usage

```json
"features": {
    "ghcr.io/wcgomes/devcontainer-features/agents-workspace:0": {}
}
```

## Options

| Options Id | Description | Type | Default Value |
|-----|-----|-----|-----|
| tool | Tool to install: opencode, claude, copilot, antigravity, all (default: all) | string | all |
| includeAgency | Install agency-agents (144+ specialized agents) | boolean | true |
| autoupdate | Check for updates on container start | boolean | true |

# Agents Workspace Feature - Additional Notes

## Behavior Overview

The feature installs agents-workspace using upstream `install.sh` from the remote repository.
It supports auto-update by tracking commit IDs from both agents-workspace and agency-agents repositories.

## Use Cases

- Install skills for all detected tools (`tool=all`)
- Install skills for a specific tool (`tool=opencode|claude|copilot|antigravity`)
- Skip agency-agents installation (`includeAgency=false`)
- Disable auto-update (`autoupdate=false`)

## Auto-Update Logic

- `agents-workspace` commit is always checked for updates
- `agency-agents` commit is only checked when `includeAgency=true`
- If either has a new commit, the installation runs again with the original options

---

_Note: This file was auto-generated from the [devcontainer-feature.json](https://github.com/wcgomes/devcontainer-features/blob/main/src/agents-workspace/devcontainer-feature.json).  Add additional notes to a `NOTES.md`._
