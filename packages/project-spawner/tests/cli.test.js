'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const os = require('node:os');
const { spawnSync } = require('node:child_process');

const cli = require('../src/cli.js');

const FIXTURES_ROOT = path.join(__dirname, 'fixtures', 'templates');
const CLI_ENTRY = path.join(__dirname, '..', 'src', 'cli.js');

async function makeTmpDir(prefix = 'harness-spawn-test-') {
  return await fsp.mkdtemp(path.join(os.tmpdir(), prefix));
}

async function rmrf(p) {
  try {
    await fsp.rm(p, { recursive: true, force: true });
  } catch {
    /* ignore */
  }
}

test('exports a stable public API', () => {
  for (const name of [
    'run',
    'main',
    'validateTemplate',
    'copyTemplate',
    'applyAiCliFilter',
    'resolveTemplatesRoot',
    'SUPPORTED_AI_CLIS',
    'AI_CLI_FILE_MAP',
  ]) {
    assert.ok(name in cli, `missing export: ${name}`);
  }
  assert.deepEqual(cli.SUPPORTED_AI_CLIS, ['claude', 'codex', 'gemini', 'all']);
});

test('invoking with no args prints help and exits 0', () => {
  const result = spawnSync(process.execPath, [CLI_ENTRY], {
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, `expected exit 0, got ${result.status}\n${result.stderr}`);
  const out = (result.stdout || '') + (result.stderr || '');
  assert.match(out, /harness-spawn/i);
  assert.match(out, /Usage|usage/);
});

test('non-existent template fails with a clear error', async () => {
  const tmp = await makeTmpDir();
  try {
    const result = await cli.run({
      template: 'does-not-exist',
      projectName: 'whatever',
      cwd: tmp,
      templatesRoot: FIXTURES_ROOT,
      skipAge: true,
    });
    assert.equal(result.ok, false);
    assert.equal(result.code, 2);
    assert.match(result.error, /not found/i);
    assert.match(result.error, /does-not-exist/);
  } finally {
    await rmrf(tmp);
  }
});

test('valid template scaffolds the project directory', async () => {
  const tmp = await makeTmpDir();
  try {
    const result = await cli.run({
      template: 'sample-stack',
      projectName: 'my-app',
      cwd: tmp,
      templatesRoot: FIXTURES_ROOT,
      skipAge: true,
    });
    assert.equal(result.ok, true, result.error);
    const target = path.join(tmp, 'my-app');
    assert.ok(fs.existsSync(target), 'target dir should exist');
    assert.ok(fs.existsSync(path.join(target, 'README.md')));
    assert.ok(fs.existsSync(path.join(target, 'package.json')));
    assert.ok(fs.existsSync(path.join(target, 'src', 'main.js')));
    assert.ok(fs.existsSync(path.join(target, '.env.sops')));
  } finally {
    await rmrf(tmp);
  }
});

test('--ai-cli=claude only ships CLAUDE.md', async () => {
  const tmp = await makeTmpDir();
  try {
    const result = await cli.run({
      template: 'sample-stack',
      projectName: 'claude-only',
      aiCli: 'claude',
      cwd: tmp,
      templatesRoot: FIXTURES_ROOT,
      skipAge: true,
    });
    assert.equal(result.ok, true, result.error);
    const target = path.join(tmp, 'claude-only');
    assert.ok(fs.existsSync(path.join(target, 'CLAUDE.md')), 'CLAUDE.md should be kept');
    assert.equal(fs.existsSync(path.join(target, 'AGENTS.md')), false, 'AGENTS.md should be removed');
    assert.equal(fs.existsSync(path.join(target, 'GEMINI.md')), false, 'GEMINI.md should be removed');
  } finally {
    await rmrf(tmp);
  }
});

test('--ai-cli=all keeps all three context files', async () => {
  const tmp = await makeTmpDir();
  try {
    const result = await cli.run({
      template: 'sample-stack',
      projectName: 'all-three',
      aiCli: 'all',
      cwd: tmp,
      templatesRoot: FIXTURES_ROOT,
      skipAge: true,
    });
    assert.equal(result.ok, true, result.error);
    const target = path.join(tmp, 'all-three');
    assert.ok(fs.existsSync(path.join(target, 'CLAUDE.md')));
    assert.ok(fs.existsSync(path.join(target, 'AGENTS.md')));
    assert.ok(fs.existsSync(path.join(target, 'GEMINI.md')));
  } finally {
    await rmrf(tmp);
  }
});

test('rejects unsupported --ai-cli values', async () => {
  const tmp = await makeTmpDir();
  try {
    const result = await cli.run({
      template: 'sample-stack',
      projectName: 'bad-ai',
      aiCli: 'cursor',
      cwd: tmp,
      templatesRoot: FIXTURES_ROOT,
      skipAge: true,
    });
    assert.equal(result.ok, false);
    assert.equal(result.code, 1);
    assert.match(result.error, /Unsupported --ai-cli/);
  } finally {
    await rmrf(tmp);
  }
});

test('refuses to overwrite an existing target directory', async () => {
  const tmp = await makeTmpDir();
  try {
    await fsp.mkdir(path.join(tmp, 'collide'));
    const result = await cli.run({
      template: 'sample-stack',
      projectName: 'collide',
      cwd: tmp,
      templatesRoot: FIXTURES_ROOT,
      skipAge: true,
    });
    assert.equal(result.ok, false);
    assert.equal(result.code, 3);
    assert.match(result.error, /already exists/i);
  } finally {
    await rmrf(tmp);
  }
});

test('writes a .env.sops skeleton', async () => {
  const tmp = await makeTmpDir();
  try {
    const result = await cli.run({
      template: 'sample-stack',
      projectName: 'has-env',
      cwd: tmp,
      templatesRoot: FIXTURES_ROOT,
      skipAge: true,
    });
    assert.equal(result.ok, true, result.error);
    const envPath = path.join(tmp, 'has-env', '.env.sops');
    const text = await fsp.readFile(envPath, 'utf8');
    assert.match(text, /\.env\.sops/);
    assert.match(text, /EXAMPLE_KEY/);
  } finally {
    await rmrf(tmp);
  }
});

test('applyAiCliFilter is a no-op when files are absent', async () => {
  const tmp = await makeTmpDir();
  try {
    const out = await cli.applyAiCliFilter(tmp, 'claude');
    assert.deepEqual(out.removed, []);
  } finally {
    await rmrf(tmp);
  }
});
