#!/usr/bin/env node
/**
 * boil-checkpoint.js — PreToolUse Boil-the-Ocean active-checkpoint hook.
 *
 * Layer 2 of the three-layer Boil-the-Ocean injection:
 *   Layer 1: root CLAUDE.md import (always on)
 *   Layer 2: this hook (active checkpoint before Write/Edit/MultiEdit)
 *   Layer 3: CI gate (full sweep on every PR)
 *
 * Behavior:
 *   - Receives the standard Claude Code hook JSON on stdin.
 *   - Spawns `node <repo-root>/tools/boil-review.js --quick` (cross-platform).
 *   - On success: emits boil-review.js's stdout as a hook context note.
 *   - On failure (script missing, non-zero exit, etc.): logs to stderr with
 *     a [BoilCheckpoint] prefix and exits 0 — never blocks tool execution.
 *
 * Designed to be invoked through scripts/hooks/run-with-flags.js so
 * ECC_HOOK_PROFILE / ECC_DISABLED_HOOKS gating still applies.
 *
 * Exposes `run(rawInput, ctx)` so run-with-flags.js can require() it.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const PREFIX = '[BoilCheckpoint]';
const DEFAULT_TIMEOUT_MS = 8000;

/**
 * Resolve the path to tools/boil-review.js relative to the package root.
 * Allows override via BOIL_REVIEW_PATH env var (used by tests).
 *
 * @param {string} pluginRoot Resolved package root from run-with-flags.js.
 * @returns {string} absolute path to boil-review.js
 */
function resolveBoilReviewPath(pluginRoot) {
  if (process.env.BOIL_REVIEW_PATH && process.env.BOIL_REVIEW_PATH.trim()) {
    return path.resolve(process.env.BOIL_REVIEW_PATH.trim());
  }

  // Package lives at <repo>/packages/harness-core; tools/ is at <repo>/tools.
  const root = pluginRoot
    ? path.resolve(pluginRoot)
    : path.resolve(__dirname, '..', '..');
  return path.resolve(root, '..', '..', 'tools', 'boil-review.js');
}

/**
 * Build the spawn args for boil-review.js. --quick keeps the latency
 * tight enough for a blocking PreToolUse hook.
 *
 * @returns {string[]}
 */
function buildArgs(scriptPath) {
  return [scriptPath, '--quick'];
}

/**
 * Hook entry point used by run-with-flags.js when the hook is required().
 *
 * @param {string} rawInput Raw stdin from Claude Code.
 * @param {{pluginRoot?: string}} ctx Optional context from the wrapper.
 * @returns {{stdout: string, stderr: string, exitCode: number}}
 */
function run(rawInput, ctx = {}) {
  const pluginRoot = ctx.pluginRoot || path.resolve(__dirname, '..', '..');
  const scriptPath = resolveBoilReviewPath(pluginRoot);

  if (!fs.existsSync(scriptPath)) {
    return {
      stdout: rawInput,
      stderr: `${PREFIX} boil-review.js not found at ${scriptPath} — skipping checkpoint\n`,
      exitCode: 0
    };
  }

  let result;
  try {
    result = spawnSync(process.execPath, buildArgs(scriptPath), {
      input: rawInput,
      encoding: 'utf8',
      timeout: DEFAULT_TIMEOUT_MS,
      env: { ...process.env, BOIL_REVIEW_MODE: 'quick' }
    });
  } catch (err) {
    return {
      stdout: rawInput,
      stderr: `${PREFIX} spawn error: ${err && err.message ? err.message : String(err)}\n`,
      exitCode: 0
    };
  }

  if (result.error) {
    return {
      stdout: rawInput,
      stderr: `${PREFIX} ${result.error.message}\n`,
      exitCode: 0
    };
  }

  if (result.signal) {
    return {
      stdout: rawInput,
      stderr: `${PREFIX} terminated by signal ${result.signal}\n`,
      exitCode: 0
    };
  }

  if (!Number.isInteger(result.status) || result.status !== 0) {
    const detail = result.stderr ? result.stderr.toString().trim() : `exit ${result.status}`;
    return {
      stdout: rawInput,
      stderr: `${PREFIX} boil-review --quick failed: ${detail}\n`,
      exitCode: 0
    };
  }

  // Pass through Claude Code's stdin unchanged so the tool call still fires;
  // surface boil-review's analysis on stderr where Claude Code shows hook
  // output as context.
  const note = result.stdout ? result.stdout.toString() : '';
  return {
    stdout: rawInput,
    stderr: note ? `${PREFIX} ${note.trim()}\n` : '',
    exitCode: 0
  };
}

module.exports = { run, resolveBoilReviewPath, buildArgs };

// Allow direct invocation (`node boil-checkpoint.js`) for ad-hoc use, but
// the canonical entry point is run-with-flags.js + require().
if (require.main === module) {
  let raw = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', chunk => {
    raw += chunk;
  });
  process.stdin.on('end', () => {
    const output = run(raw, {});
    if (output.stderr) process.stderr.write(output.stderr);
    process.stdout.write(output.stdout);
    process.exit(output.exitCode);
  });
}
