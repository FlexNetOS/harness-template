#!/usr/bin/env node
// host-detect.js
//
// Detects which AI CLI is currently driving the harness so spine commands,
// hooks, and skills can adapt their behavior. Returns a structured result:
//
//   { host: 'claude' | 'codex' | 'gemini' | 'cursor' | 'factory' |
//           'aider' | 'continue' | 'unknown',
//     confidence: 0..1,
//     signals: [ ...evidence used ] }
//
// Heuristics — combined, not exclusive. Each contributes a weight; the
// highest-scoring host wins.
//
//   1. Env vars  (strongest signal — most CLIs export their own).
//   2. Parent process name (best-effort, OS-dependent).
//   3. Working-directory artifacts (CLAUDE.md vs AGENTS.md vs GEMINI.md vs
//      .cursor/, .factory/, .aider*).
//
// We deliberately do NOT shell out to a child detector — this must be safe
// to call from blocking PreToolUse hooks (<50ms target).
//
// Required deps: Node >=20 stdlib (fs, path, os, child_process for ppid).
// CommonJS.

'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Known hosts and their detection profiles.
// envs: list of env var names; presence is a signal
// markers: filesystem markers in cwd (file or dir name)
// procNames: parent process names (lowercased) that match
const HOST_PROFILES = {
  claude: {
    envs: ['CLAUDE_PROJECT_DIR', 'CLAUDECODE', 'CLAUDE_CODE_INSIDE_TASK', 'CLAUDE_AGENT_SDK'],
    markers: ['CLAUDE.md', '.claude'],
    procNames: ['claude', 'claude.exe', 'claude-code', 'claude-code.exe'],
  },
  codex: {
    envs: ['CODEX_HOME', 'CODEX_SESSION', 'CODEX_CLI'],
    markers: ['AGENTS.md', '.codex'],
    procNames: ['codex', 'codex.exe'],
  },
  gemini: {
    envs: ['GEMINI_API_KEY', 'GEMINI_CLI', 'GEMINI_PROJECT'],
    markers: ['GEMINI.md', '.gemini'],
    procNames: ['gemini', 'gemini.exe'],
  },
  cursor: {
    envs: ['CURSOR_TRACE_ID', 'CURSOR_AGENT', 'CURSOR_SESSION_ID'],
    markers: ['.cursor', '.cursorrules'],
    procNames: ['cursor', 'cursor.exe'],
  },
  factory: {
    envs: ['FACTORY_DROID', 'DROID_SESSION', 'FACTORY_CLI'],
    markers: ['.factory', 'DROID.md'],
    procNames: ['droid', 'factory', 'droid.exe', 'factory.exe'],
  },
  aider: {
    envs: ['AIDER_MODEL', 'AIDER_CHAT_HISTORY_FILE'],
    markers: ['.aider.conf.yml', '.aider.input.history'],
    procNames: ['aider', 'aider.exe'],
  },
  continue: {
    envs: ['CONTINUE_SESSION_ID', 'CONTINUE_GLOBAL_DIR'],
    markers: ['.continue'],
    procNames: ['continue', 'continue.exe'],
  },
};

const WEIGHTS = {
  env: 0.6,
  marker: 0.25,
  proc: 0.45,
};

function envSignals(host, profile, env) {
  const hits = profile.envs.filter((name) => Object.prototype.hasOwnProperty.call(env, name));
  return hits.map((name) => ({ kind: 'env', host, evidence: name }));
}

function markerSignals(host, profile, cwd) {
  const hits = [];
  for (const m of profile.markers) {
    try {
      if (fs.existsSync(path.join(cwd, m))) {
        hits.push({ kind: 'marker', host, evidence: m });
      }
    } catch {
      /* ignore */
    }
  }
  return hits;
}

function getParentProcessName() {
  // Best-effort. Different shapes per OS; failures are silent.
  try {
    if (process.platform === 'win32') {
      const ppid = process.ppid;
      if (!ppid) return null;
      const out = execSync(
        `wmic process where ProcessId=${ppid} get Name /value`,
        { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 1500 },
      );
      const m = out.match(/Name=(.+)/);
      return m ? m[1].trim().toLowerCase() : null;
    }
    // POSIX — use ps.
    const ppid = process.ppid;
    if (!ppid) return null;
    const out = execSync(`ps -o comm= -p ${ppid}`, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 1500,
    });
    return out.trim().toLowerCase() || null;
  } catch {
    return null;
  }
}

function procSignals(host, profile, parentName) {
  if (!parentName) return [];
  const matches = profile.procNames.some((n) => parentName === n || parentName.endsWith('/' + n));
  return matches ? [{ kind: 'proc', host, evidence: parentName }] : [];
}

function detect({ env = process.env, cwd = process.cwd(), parentName = null } = {}) {
  const resolvedParent = parentName === null ? getParentProcessName() : parentName;

  const allSignals = [];
  const scores = {};
  for (const [host, profile] of Object.entries(HOST_PROFILES)) {
    scores[host] = 0;
    const sigs = [
      ...envSignals(host, profile, env),
      ...markerSignals(host, profile, cwd),
      ...procSignals(host, profile, resolvedParent),
    ];
    allSignals.push(...sigs);
    for (const s of sigs) {
      scores[host] += WEIGHTS[s.kind] || 0;
    }
  }

  // Pick the highest score; tie-break by name order in HOST_PROFILES.
  let best = null;
  let bestScore = 0;
  for (const host of Object.keys(HOST_PROFILES)) {
    if (scores[host] > bestScore) {
      best = host;
      bestScore = scores[host];
    }
  }

  if (!best || bestScore === 0) {
    return { host: 'unknown', confidence: 0, signals: [] };
  }

  // Cap confidence at 0.99 — leave room for "unknown" to express our humility.
  // Single env-var hit is moderate confidence; env+marker or env+proc is high.
  const confidence = Math.min(0.99, bestScore);

  return {
    host: best,
    confidence: Number(confidence.toFixed(2)),
    signals: allSignals.filter((s) => s.host === best),
  };
}

if (require.main === module) {
  const result = detect();
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
}

module.exports = {
  detect,
  HOST_PROFILES,
  // Exported for tests:
  envSignals,
  markerSignals,
  procSignals,
};
