#!/usr/bin/env node
// spine-fanout.js
//
// The dispatch primitive used by all 7 spine commands (think/plan/code/review/
// test/ship/reflect). Fans a phase out to a set of specialist briefs in
// parallel and merges the results with explicit conflict resolution.
//
// Public API:
//   const { dispatch } = require('./spine-fanout');
//   const merged = await dispatch({
//     phase: 'review',
//     specialists: [
//       { id: 'security', brief: '...self-contained brief...' },
//       { id: 'perf',     brief: '...' },
//     ],
//     synthesis: 'Optional synthesis instructions for the coordinator.',
//     context: { repoRoot: '/path/to/repo', diffFile: '...' },
//     // overrides for tests / unusual hosts:
//     runner: async (specialist, ctx) => ({ findings: [...], verdict, suggestions }),
//   });
//
// Runtime detection (when `runner` is not supplied):
//   1. If process.env.CLAUDE_CODE_TASK_TOOL is set (i.e. we are inside Claude
//      Code with the Task subagent tool), spine commands are expected to
//      invoke this module via the SDK and pass an explicit `runner`. We
//      surface a clear error if no runner is given but we appear to be in
//      a Task-capable host — it's never safe to silently fall back.
//   2. Otherwise we shell out to `claude` CLI subprocesses in parallel
//      (headless mode). If `claude` is not on PATH, we fall back to a
//      stub-runner that surfaces a placeholder result so callers and tests
//      can wire up the rest of the pipeline.
//
// Merge rules:
//   findings    — union (deduplicated by `${specialist}::${title}`)
//   verdict     — max severity (block > warn > pass)
//   suggestions — deduplicated by case-insensitive trimmed text
//
// Required deps: Node >=20 stdlib (child_process, os).
// CommonJS.

'use strict';

const { spawn } = require('child_process');
const os = require('os');

const VERDICT_RANK = { pass: 0, warn: 1, block: 2 };

function isTaskHost() {
  return Boolean(
    process.env.CLAUDE_CODE_TASK_TOOL ||
      process.env.CLAUDE_CODE_INSIDE_TASK ||
      process.env.CLAUDE_AGENT_SDK,
  );
}

function hasClaudeCli() {
  // Cheap sync check — does PATH contain `claude`?
  // We look for the env var override first because tests rely on it.
  if (process.env.SPINE_FANOUT_FORCE_CLAUDE === '1') return true;
  if (process.env.SPINE_FANOUT_FORCE_CLAUDE === '0') return false;
  const path = process.env.PATH || '';
  const ext = process.platform === 'win32' ? ['.cmd', '.exe', '.bat', ''] : [''];
  const sep = process.platform === 'win32' ? ';' : ':';
  const fs = require('fs');
  const pathMod = require('path');
  for (const dir of path.split(sep)) {
    if (!dir) continue;
    for (const e of ext) {
      const candidate = pathMod.join(dir, 'claude' + e);
      try {
        if (fs.existsSync(candidate)) return true;
      } catch {
        /* ignore */
      }
    }
  }
  return false;
}

function dedupeFindings(findings) {
  const seen = new Set();
  const out = [];
  for (const f of findings) {
    const key = `${(f.specialist || '').toLowerCase()}::${(f.title || f.message || JSON.stringify(f)).toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(f);
  }
  return out;
}

function dedupeSuggestions(suggestions) {
  const seen = new Set();
  const out = [];
  for (const s of suggestions) {
    const text = typeof s === 'string' ? s : (s && s.text) || JSON.stringify(s);
    const key = text.trim().toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s);
  }
  return out;
}

function mergeResults(results, { synthesis } = {}) {
  const findings = [];
  const suggestions = [];
  let verdict = 'pass';
  const errors = [];

  for (const r of results) {
    if (r.error) {
      errors.push({ specialist: r.specialist, error: String(r.error) });
      continue;
    }
    const tagged = (r.findings || []).map((f) => ({ ...f, specialist: r.specialist }));
    findings.push(...tagged);
    suggestions.push(...(r.suggestions || []));
    const v = (r.verdict || 'pass').toLowerCase();
    if ((VERDICT_RANK[v] ?? 0) > (VERDICT_RANK[verdict] ?? 0)) verdict = v;
  }

  return {
    verdict,
    findings: dedupeFindings(findings),
    suggestions: dedupeSuggestions(suggestions),
    errors,
    synthesis: synthesis || null,
  };
}

// Headless fallback: spawn `claude -p <brief>` subprocesses in parallel.
// We assume the brief is fully self-contained text. The claude CLI is asked
// to emit JSON; if it doesn't, we wrap the raw text into a `findings[]` of
// length 1 so the merge still works.
async function runClaudeSubprocess(specialist) {
  return await new Promise((resolve) => {
    const args = ['-p', specialist.brief, '--output-format', 'json'];
    const child = spawn('claude', args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (b) => (stdout += b.toString()));
    child.stderr.on('data', (b) => (stderr += b.toString()));
    child.on('error', (err) => {
      resolve({ specialist: specialist.id, error: err.message });
    });
    child.on('close', () => {
      try {
        const parsed = JSON.parse(stdout);
        resolve({ specialist: specialist.id, ...parsed });
      } catch {
        resolve({
          specialist: specialist.id,
          findings: stdout.trim()
            ? [{ kind: 'info', message: stdout.trim() }]
            : [],
          verdict: 'pass',
          suggestions: [],
          stderr: stderr.trim() || undefined,
        });
      }
    });
  });
}

function stubRunner(specialist) {
  return Promise.resolve({
    specialist: specialist.id,
    findings: [
      {
        kind: 'info',
        message: `[stub] No host runner available; specialist '${specialist.id}' was not actually executed.`,
      },
    ],
    verdict: 'pass',
    suggestions: [],
  });
}

async function dispatch({
  phase,
  specialists = [],
  synthesis = null,
  context = {},
  runner = null,
  concurrency = Math.min(specialists.length, Math.max(1, os.cpus().length)),
} = {}) {
  if (!phase) throw new Error('dispatch: `phase` is required');
  if (!Array.isArray(specialists)) throw new Error('dispatch: `specialists` must be an array');
  if (specialists.length === 0) {
    return { verdict: 'pass', findings: [], suggestions: [], errors: [], synthesis };
  }

  // Determine the runner to use.
  let effectiveRunner = runner;
  if (!effectiveRunner) {
    if (isTaskHost()) {
      // We're inside Claude Code but the caller didn't wire up a Task runner.
      // Surface this loudly — silent fallback would be wrong.
      throw new Error(
        'spine-fanout.dispatch: detected Claude Code Task host but no `runner` provided. ' +
          'Spine commands must pass a Task-tool runner when invoking from inside Claude Code.',
      );
    }
    effectiveRunner = hasClaudeCli() ? runClaudeSubprocess : stubRunner;
  }

  // Bounded-concurrency parallel dispatch. Simple worker queue.
  const queue = specialists.slice();
  const results = [];
  async function worker() {
    while (queue.length) {
      const next = queue.shift();
      try {
        const r = await effectiveRunner(next, { phase, context });
        results.push({ specialist: next.id, ...r });
      } catch (err) {
        results.push({ specialist: next.id, error: err.message || String(err) });
      }
    }
  }
  const workers = Array.from({ length: Math.max(1, concurrency) }, () => worker());
  await Promise.all(workers);

  return mergeResults(results, { synthesis });
}

module.exports = {
  dispatch,
  mergeResults,
  dedupeFindings,
  dedupeSuggestions,
  isTaskHost,
  hasClaudeCli,
  VERDICT_RANK,
};
