// Smoke test for @harness-template/skills-domain
// Verifies: skills/ directory exists and a representative sample of expected
// domain skill packs are present.

'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const PKG_ROOT = path.resolve(__dirname, '..');
const SKILLS_DIR = path.join(PKG_ROOT, 'skills');

// Sample of expected skill folders migrated from agent_harness/skills/.
const EXPECTED_SKILLS = [
  'accessibility',
  'api-design',
  'agentic-engineering',
  'architecture-decision-records',
  'backend-patterns',
  'coding-standards',
  'database-migrations',
  'e2e-testing',
  'frontend-patterns',
  'git-workflow',
  'python-patterns',
  'python-testing',
  'rust-patterns',
  'security-review',
  'tdd-workflow',
];

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

check('skills/ directory exists', () => {
  assert.ok(
    fs.existsSync(SKILLS_DIR) && fs.statSync(SKILLS_DIR).isDirectory(),
    `missing ${SKILLS_DIR}`
  );
});

check('skills/ directory has many entries (> 50)', () => {
  const entries = fs.readdirSync(SKILLS_DIR);
  assert.ok(entries.length > 50, `expected > 50 skills, found ${entries.length}`);
});

for (const skill of EXPECTED_SKILLS) {
  check(`expected skill "${skill}" present`, () => {
    const p = path.join(SKILLS_DIR, skill);
    assert.ok(fs.existsSync(p) && fs.statSync(p).isDirectory(), `missing skill: ${p}`);
  });
}

if (failed > 0) {
  console.error(`\n${failed} check(s) failed`);
  process.exit(1);
}
console.log('\nall smoke checks passed');
