
# Agency Agents (agency-agents)

A complete AI agency at your fingertips - From frontend wizards to Reddit community ninjas, from whimsy injectors to reality checkers. Each agent is a specialized expert with personality, processes, and proven deliverables. Credits: https://github.com/msitarzewski/agency-agents.

## Example Usage

```json
"features": {
    "ghcr.io/wcgomes/devcontainer-features/agency-agents:0": {}
}
```

## Options

| Options Id | Description | Type | Default Value |
|-----|-----|-----|-----|
| tool | Tool name passed to ./scripts/install.sh --tool <tool>. Use 'auto' for --parallel auto-detection. | string | auto |
| autoupdate | Check for updates on container start | boolean | true |

# Agency Agents Feature - Additional Notes

## Behavior Overview

The feature installs agency agents using upstream `convert.sh` and `install.sh`.
No workspace instructions files are created or modified.

## Use Cases

- Install agents for auto-detected tools (`tool=auto`)
- Install agents for a specific tool (`tool=<name>`)


---

_Note: This file was auto-generated from the [devcontainer-feature.json](https://github.com/wcgomes/devcontainer-features/blob/main/src/agency-agents/devcontainer-feature.json).  Add additional notes to a `NOTES.md`._
