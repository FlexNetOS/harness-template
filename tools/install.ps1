# tools/install.ps1
#
# Windows / PowerShell installer counterpart to install.sh. Installs `sops`
# and `age` via scoop or chocolatey (whichever is available), and optionally
# the three supported AI CLIs via -WithCli.
#
# Idempotent.
#
# Usage:
#   ./tools/install.ps1
#   ./tools/install.ps1 -WithCli
#   ./tools/install.ps1 -DryRun -WithCli
#
# Exit codes mirror install.sh.

[CmdletBinding()]
param(
    [switch]$WithCli,
    [switch]$DryRun,
    [switch]$NoSops,
    [switch]$NoAge
)

$ErrorActionPreference = 'Stop'

function Invoke-Step {
    param([string]$Description, [scriptblock]$Action)
    if ($DryRun) {
        Write-Host "[dry-run] $Description"
    } else {
        Write-Host "+ $Description"
        & $Action
    }
}

function Test-Command {
    param([string]$Name)
    return [bool](Get-Command $Name -ErrorAction SilentlyContinue)
}

function Get-PackageManager {
    if (Test-Command scoop) { return 'scoop' }
    if (Test-Command choco) { return 'choco' }
    if (Test-Command winget) { return 'winget' }
    return 'unknown'
}

function Install-Package {
    param([string]$Pkg, [string]$Pm)

    if (Test-Command $Pkg) {
        Write-Host "$Pkg already installed - skipping."
        return
    }

    switch ($Pm) {
        'scoop' {
            Invoke-Step "scoop install $Pkg" { scoop install $Pkg }
        }
        'choco' {
            Invoke-Step "choco install $Pkg" { choco install -y $Pkg }
        }
        'winget' {
            Invoke-Step "winget install $Pkg" { winget install --id $Pkg --accept-package-agreements --accept-source-agreements }
        }
        default {
            Write-Warning "No recognized package manager. Install '$Pkg' manually."
        }
    }
}

$pm = Get-PackageManager
Write-Host "Detected package manager: $pm"

if (-not $NoSops) { Install-Package -Pkg 'sops' -Pm $pm }
if (-not $NoAge)  { Install-Package -Pkg 'age'  -Pm $pm }

if ($WithCli) {
    Write-Host "Installing AI CLIs (claude, codex, gemini) where available..."
    foreach ($cli in @('claude', 'codex', 'gemini')) {
        if (Test-Command $cli) {
            Write-Host "$cli already installed - skipping."
            continue
        }
        try {
            Install-Package -Pkg $cli -Pm $pm
        } catch {
            Write-Warning "Failed to install ${cli}: $_"
        }
    }
}

Write-Host "Done."
