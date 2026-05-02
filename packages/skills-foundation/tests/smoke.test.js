'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const PACKAGE_ROOT = path.resolve(__dirname, '..');
const SKILLS_DIR = path.join(PACKAGE_ROOT, 'skills');

const EXPECTED_SKILLS = [
  'delegate',
  'wiki',
  'implement',
  'debug',
  'agents-skills',
];

const EXPECTED_COMMANDS = {
  delegate: '/aw:delegate',
  wiki: '/aw:wiki',
  implement: '/aw:implement',
  debug: '/aw:debug',
  'agents-skills': '/aw:agents-skills',
};

test('skills/ directory exists', () => {
  assert.ok(fs.existsSync(SKILLS_DIR), `skills/ missing at ${SKILLS_DIR}`);
  const stat = fs.statSync(SKILLS_DIR);
  assert.ok(stat.isDirectory(), 'skills/ is not a directory');
});

test('AGENTS.md preserved at package root', () => {
  const agentsPath = path.join(PACKAGE_ROOT, 'AGENTS.md');
  assert.ok(fs.existsSync(agentsPath), 'AGENTS.md missing');
  const contents = fs.readFileSync(agentsPath, 'utf8');
  assert.ok(contents.length > 0, 'AGENTS.md is empty');
});

for (const skill of EXPECTED_SKILLS) {
  test(`skill "${skill}" folder exists`, () => {
    const skillPath = path.join(SKILLS_DIR, skill);
    assert.ok(fs.existsSync(skillPath), `skills/${skill}/ missing`);
    assert.ok(fs.statSync(skillPath).isDirectory(), `skills/${skill}/ is not a directory`);
  });

  test(`skill "${skill}" has SKILL.md`, () => {
    const skillMd = path.join(SKILLS_DIR, skill, 'SKILL.md');
    assert.ok(fs.existsSync(skillMd), `skills/${skill}/SKILL.md missing`);
    const stat = fs.statSync(skillMd);
    assert.ok(stat.isFile(), `skills/${skill}/SKILL.md is not a file`);
    assert.ok(stat.size > 0, `skills/${skill}/SKILL.md is empty`);
  });

  test(`skill "${skill}" SKILL.md declares /aw: command`, () => {
    const skillMd = path.join(SKILLS_DIR, skill, 'SKILL.md');
    const contents = fs.readFileSync(skillMd, 'utf8');
    const expected = EXPECTED_COMMANDS[skill];
    assert.ok(
      contents.includes(`command: ${expected}`),
      `skills/${skill}/SKILL.md missing "command: ${expected}" frontmatter`
    );
  });

  test(`skill "${skill}" SKILL.md has matching name frontmatter`, () => {
    const skillMd = path.join(SKILLS_DIR, skill, 'SKILL.md');
    const contents = fs.readFileSync(skillMd, 'utf8');
    assert.ok(
      contents.includes(`name: ${skill}`),
      `skills/${skill}/SKILL.md missing "name: ${skill}" frontmatter`
    );
  });
}
