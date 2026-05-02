// tools/tests/host-detect.test.js
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { detect, HOST_PROFILES } = require(path.join('..', 'host-detect.js'));

function tmpdir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'host-detect-'));
}

test('returns unknown when nothing matches', () => {
  const dir = tmpdir();
  const result = detect({ env: {}, cwd: dir, parentName: 'bash' });
  assert.equal(result.host, 'unknown');
  assert.equal(result.confidence, 0);
});

test('detects claude via env var', () => {
  const dir = tmpdir();
  const result = detect({
    env: { CLAUDE_PROJECT_DIR: dir },
    cwd: dir,
    parentName: 'bash',
  });
  assert.equal(result.host, 'claude');
  assert.ok(result.confidence > 0);
  assert.ok(result.signals.some((s) => s.kind === 'env'));
});

test('detects codex via marker file', () => {
  const dir = tmpdir();
  fs.writeFileSync(path.join(dir, 'AGENTS.md'), 'agents');
  const result = detect({ env: {}, cwd: dir, parentName: 'bash' });
  assert.equal(result.host, 'codex');
});

test('detects gemini via env + marker (higher confidence)', () => {
  const dir = tmpdir();
  fs.writeFileSync(path.join(dir, 'GEMINI.md'), 'gemini');
  const result = detect({
    env: { GEMINI_API_KEY: 'x' },
    cwd: dir,
    parentName: 'bash',
  });
  assert.equal(result.host, 'gemini');
  assert.ok(result.confidence >= 0.6);
});

test('detects cursor via .cursor directory', () => {
  const dir = tmpdir();
  fs.mkdirSync(path.join(dir, '.cursor'));
  const result = detect({ env: {}, cwd: dir, parentName: 'bash' });
  assert.equal(result.host, 'cursor');
});

test('detects via parent process name', () => {
  const dir = tmpdir();
  const result = detect({ env: {}, cwd: dir, parentName: 'codex' });
  assert.equal(result.host, 'codex');
});

test('confidence is capped at 0.99', () => {
  const dir = tmpdir();
  fs.writeFileSync(path.join(dir, 'CLAUDE.md'), 'claude');
  fs.mkdirSync(path.join(dir, '.claude'));
  const result = detect({
    env: {
      CLAUDE_PROJECT_DIR: dir,
      CLAUDECODE: '1',
      CLAUDE_CODE_INSIDE_TASK: '1',
      CLAUDE_AGENT_SDK: '1',
    },
    cwd: dir,
    parentName: 'claude',
  });
  assert.equal(result.host, 'claude');
  assert.ok(result.confidence <= 0.99);
});

test('all known hosts are detectable', () => {
  // Smoke test: every entry in HOST_PROFILES should be reachable via env hit.
  for (const [host, profile] of Object.entries(HOST_PROFILES)) {
    const env = {};
    env[profile.envs[0]] = '1';
    const dir = tmpdir();
    const result = detect({ env, cwd: dir, parentName: 'bash' });
    assert.equal(result.host, host, `failed to detect ${host} via env ${profile.envs[0]}`);
  }
});
