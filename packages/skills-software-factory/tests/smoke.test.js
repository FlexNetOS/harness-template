// Smoke test for @harness-template/skills-software-factory
// Verifies: package folder structure exists; the seven spine command names
// are NOT present at the package root (collision detection vs harness-core).

'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const PKG_ROOT = path.resolve(__dirname, '..');

const SPINE_NAMES = ['think', 'plan', 'code', 'build', 'review', 'test', 'ship', 'reflect'];

// Sample of expected non-spine gstack folders that should be present.
const EXPECTED_FOLDERS = [
  'agents',
  'bin',
  'browse',
  'hosts',
  'extension',
  'supabase',
  'scripts',
  'autoplan',
  'careful',
  'design-review',
  'investigate',
  'learn',
  'retro',
  'skillify',
];

// Expected top-level docs migrated from gstack root.
const EXPECTED_DOCS = ['AGENTS.md', 'ARCHITECTURE.md', 'README.md', 'CLAUDE.md', 'package.json'];

let failed = 0;
function check(label, fn) {
  try {
    fn();
    console.log(`ok  - ${label}`);
  } catch (err) {
    failed += 1;
    console.error(`not ok - ${label}`);
    console.error(`        ${err.message}`);
  }
}

check('package root exists', () => {
  assert.ok(fs.existsSync(PKG_ROOT), `missing ${PKG_ROOT}`);
});

for (const name of SPINE_NAMES) {
  check(`spine name "${name}" must NOT be present at package root`, () => {
    const p = path.join(PKG_ROOT, name);
    assert.ok(!fs.existsSync(p), `spine collision: ${p} exists but belongs to harness-core/commands/`);
  });
}

for (const folder of EXPECTED_FOLDERS) {
  check(`expected folder "${folder}" present`, () => {
    const p = path.join(PKG_ROOT, folder);
    assert.ok(fs.existsSync(p) && fs.statSync(p).isDirectory(), `missing folder: ${p}`);
  });
}

for (const doc of EXPECTED_DOCS) {
  check(`expected doc "${doc}" present`, () => {
    const p = path.join(PKG_ROOT, doc);
    assert.ok(fs.existsSync(p) && fs.statSync(p).isFile(), `missing file: ${p}`);
  });
}

if (failed > 0) {
  console.error(`\n${failed} check(s) failed`);
  process.exit(1);
}
console.log('\nall smoke checks passed');
