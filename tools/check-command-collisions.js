#!/usr/bin/env node
// check-command-collisions.js
//
// Ensures no package other than the canonical owner declares one of the
// reserved spine command names, and that the `/aw:*` namespace stays inside
// `packages/skills-foundation/`.
//
// Phase-ownership matrix (source of truth):
//   - packages/harness-core/commands/         owns: think, plan, code, review,
//                                                   test, ship, reflect
//   - packages/skills-foundation/             owns: aw:*  (namespace prefix)
//
// Scans:
//   - packages/* /commands/*.md
//   - packages/skills-* /skills/* /SKILL.md (looks for `name:` frontmatter)
//
// CLI:
//   node tools/check-command-collisions.js [--root <repo-root>] [--json]
//
// Exit codes:
//   0  no violations
//   1  one or more violations
//
// Required deps: Node >=20 stdlib (fs, path).
// CommonJS.

'use strict';

const fs = require('fs');
const path = require('path');

const SPINE_COMMANDS = ['think', 'plan', 'code', 'review', 'test', 'ship', 'reflect'];
const SPINE_OWNER_DIR = path.posix.join('packages', 'harness-core', 'commands');
const AW_NAMESPACE_OWNER = 'skills-foundation'; // matches packages/skills-foundation

function toPosix(p) {
  return p.split(path.sep).join('/');
}

function listDir(p) {
  try {
    return fs.readdirSync(p, { withFileTypes: true });
  } catch {
    return [];
  }
}

function getCommandNameFromFile(filePath) {
  // Convention: command name = basename without extension.
  // We also peek inside frontmatter for explicit `name:` overrides.
  const base = path.basename(filePath).replace(/\.md$/i, '');
  let frontmatterName = null;
  try {
    const text = fs.readFileSync(filePath, 'utf8');
    const m = text.match(/^---\s*\n([\s\S]*?)\n---/);
    if (m) {
      const nameMatch = m[1].match(/^\s*name\s*:\s*(.+)\s*$/m);
      if (nameMatch) {
        frontmatterName = nameMatch[1].trim().replace(/^["']|["']$/g, '');
      }
    }
  } catch {
    /* ignore */
  }
  return frontmatterName || base;
}

function getSkillName(filePath) {
  try {
    const text = fs.readFileSync(filePath, 'utf8');
    const m = text.match(/^---\s*\n([\s\S]*?)\n---/);
    if (m) {
      const nameMatch = m[1].match(/^\s*name\s*:\s*(.+)\s*$/m);
      if (nameMatch) return nameMatch[1].trim().replace(/^["']|["']$/g, '');
    }
  } catch {
    /* ignore */
  }
  return null;
}

function scan({ root = process.cwd() } = {}) {
  const violations = [];
  const inspected = [];
  const packagesDir = path.join(root, 'packages');
  for (const pkg of listDir(packagesDir)) {
    if (!pkg.isDirectory()) continue;
    const pkgName = pkg.name;
    const pkgRoot = path.join(packagesDir, pkgName);

    // 1. Inspect <pkg>/commands/*.md
    const commandsDir = path.join(pkgRoot, 'commands');
    for (const entry of listDir(commandsDir)) {
      if (!entry.isFile() || !entry.name.endsWith('.md')) continue;
      const filePath = path.join(commandsDir, entry.name);
      const name = getCommandNameFromFile(filePath);
      const relPath = toPosix(path.relative(root, filePath));
      inspected.push({ kind: 'command', name, file: relPath, package: pkgName });

      // Spine reservation
      if (SPINE_COMMANDS.includes(name) && pkgName !== 'harness-core') {
        violations.push({
          rule: 'spine-reservation',
          name,
          file: relPath,
          message: `Spine command '/${name}' may only be defined in ${SPINE_OWNER_DIR}/, not in packages/${pkgName}/commands/.`,
        });
      }

      // /aw: namespace reservation
      if (name.startsWith('aw:') && pkgName !== AW_NAMESPACE_OWNER) {
        violations.push({
          rule: 'aw-namespace',
          name,
          file: relPath,
          message: `Command '/${name}' uses the reserved 'aw:' namespace; only packages/${AW_NAMESPACE_OWNER}/ may define it.`,
        });
      }
    }

    // 2. Inspect skills-*/skills/*/SKILL.md
    if (pkgName.startsWith('skills-') || pkgName === AW_NAMESPACE_OWNER) {
      const skillsDir = path.join(pkgRoot, 'skills');
      for (const skillEntry of listDir(skillsDir)) {
        if (!skillEntry.isDirectory()) continue;
        const skillFile = path.join(skillsDir, skillEntry.name, 'SKILL.md');
        if (!fs.existsSync(skillFile)) continue;
        const name = getSkillName(skillFile) || skillEntry.name;
        const relPath = toPosix(path.relative(root, skillFile));
        inspected.push({ kind: 'skill', name, file: relPath, package: pkgName });

        if (SPINE_COMMANDS.includes(name)) {
          violations.push({
            rule: 'spine-reservation',
            name,
            file: relPath,
            message: `Skill '${name}' shadows the reserved spine command name. Spine names are owned by ${SPINE_OWNER_DIR}/.`,
          });
        }
        if (name.startsWith('aw:') && pkgName !== AW_NAMESPACE_OWNER) {
          violations.push({
            rule: 'aw-namespace',
            name,
            file: relPath,
            message: `Skill '${name}' uses the reserved 'aw:' namespace; only packages/${AW_NAMESPACE_OWNER}/ may define it.`,
          });
        }
      }
    }
  }

  return { violations, inspected };
}

function formatTextReport({ violations, inspected }) {
  const lines = [];
  lines.push(`Inspected ${inspected.length} command/skill definitions.`);
  if (!violations.length) {
    lines.push('No collisions found.');
    return lines.join('\n');
  }
  lines.push(`Found ${violations.length} violation(s):`);
  for (const v of violations) {
    lines.push(`  [${v.rule}] ${v.file}: ${v.message}`);
  }
  return lines.join('\n');
}

function main(argv = process.argv.slice(2)) {
  let root = process.cwd();
  let json = false;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--root') root = argv[++i];
    else if (argv[i] === '--json') json = true;
  }
  const result = scan({ root });
  const exitCode = result.violations.length ? 1 : 0;
  const output = json ? JSON.stringify(result, null, 2) : formatTextReport(result);
  return { exitCode, output };
}

if (require.main === module) {
  const { exitCode, output } = main();
  process.stdout.write(output + '\n');
  process.exit(exitCode);
}

module.exports = {
  scan,
  main,
  SPINE_COMMANDS,
  SPINE_OWNER_DIR,
  AW_NAMESPACE_OWNER,
};
