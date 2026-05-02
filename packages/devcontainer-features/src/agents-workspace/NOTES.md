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