// tools/tests/boil-review.test.js
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const {
  SECTIONS,
  parseArgs,
  runQuick,
  runFull,
  extractAddedLines,
} = require(path.join('..', 'boil-review.js'));

test('SECTIONS contains all 10 garry-mega-plan sections', () => {
  assert.equal(SECTIONS.length, 10);
  const ids = SECTIONS.map((s) => s.id);
  for (const expected of [
    'architecture', 'errors', 'security', 'data-flow', 'code-quality',
    'tests', 'performance', 'observability', 'deployment', 'trajectory',
  ]) {
    assert.ok(ids.includes(expected), `missing section: ${expected}`);
  }
});

test('parseArgs handles modes and flags', () => {
  assert.deepEqual(parseArgs(['--quick']).mode, 'quick');
  assert.deepEqual(parseArgs(['--full']).mode, 'full');
  assert.equal(parseArgs(['--full', '--json']).json, true);
  assert.equal(parseArgs(['--full', '--diff-file', '/tmp/x']).diffFile, '/tmp/x');
});

test('runQuick markdown output includes all 10 sections and a stable header', () => {
  const { exitCode, output } = runQuick({ json: false });
  assert.equal(exitCode, 0);
  assert.match(output, /<!-- boil-review\.checklist v1\.0 mode=quick -->/);
  for (const s of SECTIONS) {
    assert.ok(output.includes(s.title), `expected output to include section ${s.title}`);
  }
});

test('runQuick json output is well-formed', () => {
  const { output } = runQuick({ json: true });
  const parsed = JSON.parse(output);
  assert.equal(parsed.kind, 'boil-review.checklist');
  assert.equal(parsed.sections.length, 10);
});

test('runQuick is fast (<200ms)', () => {
  const start = Date.now();
  runQuick({ json: false });
  const elapsed = Date.now() - start;
  assert.ok(elapsed < 200, `runQuick took ${elapsed}ms (>=200ms)`);
});

test('extractAddedLines parses unified diff', () => {
  const diff = [
    'diff --git a/foo.js b/foo.js',
    '--- a/foo.js',
    '+++ b/foo.js',
    '@@ -1,2 +1,3 @@',
    ' const a = 1;',
    '+const b = 2;',
    '+function broken() { try {} catch (e) {} }',
    ' const c = 3;',
  ].join('\n');
  const added = extractAddedLines(diff);
  assert.equal(added.length, 2);
  assert.equal(added[0].file, 'foo.js');
  assert.equal(added[0].text, 'const b = 2;');
});

test('runFull flags critical findings (empty catch) and exits with 2', () => {
  const diff = [
    '+++ b/dangerous.js',
    '+try { doStuff() } catch (e) {}',
  ].join('\n');
  const { exitCode, output } = runFull({ json: true, diffText: diff });
  assert.equal(exitCode, 2);
  const report = JSON.parse(output);
  assert.equal(report.severity, 'critical');
  const errSection = report.sections.find((s) => s.id === 'errors');
  assert.ok(errSection.findings.length >= 1);
  assert.equal(errSection.findings[0].kind, 'critical');
});

test('runFull on empty diff exits 0 (info-only)', () => {
  const { exitCode, output } = runFull({ json: true, diffText: '' });
  assert.equal(exitCode, 0);
  const report = JSON.parse(output);
  assert.equal(report.severity, 'info');
  assert.equal(report.sections.length, 10);
});

test('runFull warns when source file is touched without tests', () => {
  const diff = [
    '+++ b/src/foo.js',
    '+function newFeature() { return 1 + 1; }',
  ].join('\n');
  const { exitCode, output } = runFull({ json: true, diffText: diff });
  const report = JSON.parse(output);
  const tests = report.sections.find((s) => s.id === 'tests');
  assert.ok(tests.findings.length >= 1);
  assert.ok(['warn', 'critical'].includes(report.severity));
  // 1 == warnings only
  assert.equal(exitCode, 1);
});

test('runFull markdown output renders sections with titles', () => {
  const { output } = runFull({ json: false, diffText: '' });
  assert.match(output, /# Boil-the-Ocean Review Report/);
  for (const s of SECTIONS) {
    assert.ok(output.includes(s.title));
  }
});
