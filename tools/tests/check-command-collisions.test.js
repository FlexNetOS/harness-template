// tools/tests/check-command-collisions.test.js
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { scan, SPINE_COMMANDS } = require(path.join('..', 'check-command-collisions.js'));

function makeFixtureRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'collide-fix-'));
}

function writeCommand(root, pkg, name, frontmatterName) {
  const dir = path.join(root, 'packages', pkg, 'commands');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, name + '.md');
  const fm = frontmatterName
    ? `---\nname: ${frontmatterName}\ndescription: x\n---\n`
    : `---\ndescription: x\n---\n`;
  fs.writeFileSync(file, fm + 'body\n');
}

function writeSkill(root, pkg, slug, name) {
  const dir = path.join(root, 'packages', pkg, 'skills', slug);
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, 'SKILL.md');
  fs.writeFileSync(file, `---\nname: ${name || slug}\n---\nbody\n`);
}

test('clean fixture has no violations', () => {
  const root = makeFixtureRoot();
  // harness-core owns spine commands — that's allowed.
  for (const c of SPINE_COMMANDS) {
    writeCommand(root, 'harness-core', c);
  }
  // skills-foundation owns aw:* commands.
  writeCommand(root, 'skills-foundation', 'aw_setup', 'aw:setup');
  // Ordinary command in another package.
  writeCommand(root, 'app-feature', 'doit');

  const { violations } = scan({ root });
  assert.deepEqual(violations, []);
});

test('detects spine command in wrong package', () => {
  const root = makeFixtureRoot();
  writeCommand(root, 'rogue-pkg', 'plan');
  const { violations } = scan({ root });
  assert.ok(violations.length >= 1);
  assert.ok(violations.some((v) => v.rule === 'spine-reservation' && v.name === 'plan'));
});

test('detects aw: namespace squatting', () => {
  const root = makeFixtureRoot();
  writeCommand(root, 'rogue-pkg', 'aw_evil', 'aw:evil');
  const { violations } = scan({ root });
  assert.ok(violations.some((v) => v.rule === 'aw-namespace'));
});

test('skills cannot shadow spine names', () => {
  const root = makeFixtureRoot();
  writeSkill(root, 'skills-rogue', 'plan-skill', 'plan');
  const { violations } = scan({ root });
  assert.ok(violations.some((v) => v.rule === 'spine-reservation' && v.name === 'plan'));
});

test('main returns exitCode 0 for clean tree, 1 for violations', () => {
  const cleanRoot = makeFixtureRoot();
  const dirtyRoot = makeFixtureRoot();
  writeCommand(dirtyRoot, 'evil', 'review');

  const { main } = require(path.join('..', 'check-command-collisions.js'));
  assert.equal(main(['--root', cleanRoot, '--json']).exitCode, 0);
  assert.equal(main(['--root', dirtyRoot, '--json']).exitCode, 1);
});

test('main with --json returns parseable JSON', () => {
  const root = makeFixtureRoot();
  writeCommand(root, 'evil', 'ship');
  const { main } = require(path.join('..', 'check-command-collisions.js'));
  const { output } = main(['--root', root, '--json']);
  const parsed = JSON.parse(output);
  assert.ok(Array.isArray(parsed.violations));
  assert.ok(parsed.violations.length >= 1);
});
