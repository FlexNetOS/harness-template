'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const skillDir = path.join(__dirname, '..', 'skills', 'karpathy-guidelines');
const skillFile = path.join(skillDir, 'SKILL.md');

assert.ok(
  fs.existsSync(skillDir) && fs.statSync(skillDir).isDirectory(),
  'karpathy-guidelines skill directory should exist'
);

assert.ok(
  fs.existsSync(skillFile) && fs.statSync(skillFile).isFile(),
  'karpathy-guidelines SKILL.md should exist'
);

const body = fs.readFileSync(skillFile, 'utf8');
assert.ok(body.includes('name: karpathy-guidelines'), 'SKILL.md should declare its name in frontmatter');
assert.ok(body.includes('Think Before Coding'), 'SKILL.md should contain the four principles');
assert.ok(body.includes('Simplicity First'), 'SKILL.md should contain the four principles');
assert.ok(body.includes('Surgical Changes'), 'SKILL.md should contain the four principles');
assert.ok(body.includes('Goal-Driven Execution'), 'SKILL.md should contain the four principles');

console.log('skills-guidelines smoke test: OK');
