# OpenCode Feature - Additional Notes

## Volume Mounts

Opencode stores its configuration, data, and state under `~/.opencode` in three subdirectories:

- `config` – configuration files
- `data` – project data and caches
- `state` – runtime state

When these directories are volume-mounted into the container, they may be owned by `root` depending on how the volumes are created. The `opencode-fix-permissions` script runs on container start to `chown` these directories to the specified user, ensuring opencode can read and write them without permission errors.

```json
"mounts": [
		{
			"source": "opencode-config",
			"target": "/home/vscode/.config/opencode",
			"type": "volume"
		},
		{
			"source": "opencode-data",
			"target": "/home/vscode/.local/share/opencode",
			"type": "volume"
		},
		{
			"source": "opencode-state",
			"target": "/home/vscode/.local/state/opencode",
			"type": "volume"
		}
	]
```

## Shared Volumes Between Projects

If you share the same `~/.opencode` volume mounts across multiple projects, be aware that opencode's state and data will be shared as well. This can be useful for preserving context between projects, but may also cause unexpected behaviour if projects have conflicting configurations. Consider using separate volume mounts per project if isolation is needed.