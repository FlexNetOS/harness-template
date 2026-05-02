#!/usr/bin/env node
/**
 * harness-spawn CLI
 *
 * Scaffolds a new project from `templates/<template-name>/` in the harness-template
 * monorepo into a target directory under the current working directory.
 *
 * Usage:
 *   harness-spawn <template-name> <project-name> [--ai-cli=claude|codex|gemini|all]
 */

'use strict';

const path = require('path');
const fs = require('fs');
const fsp = require('fs/promises');
const os = require('os');
const { spawnSync } = require('child_process');

const cac = require('cac');
const chalk = require('chalk');

const { name: PKG_NAME, version: PKG_VERSION } = require('../package.json');

const SUPPORTED_AI_CLIS = ['claude', 'codex', 'gemini', 'all'];
const AI_CLI_FILE_MAP = {
  claude: 'CLAUDE.md',
  codex: 'AGENTS.md',
  gemini: 'GEMINI.md',
};

/**
 * Resolve the templates root for a given monorepo layout.
 * Default layout: packages/project-spawner/src/cli.js -> ../../../templates
 */
function resolveTemplatesRoot(opts = {}) {
  if (opts.templatesRoot) return opts.templatesRoot;
  if (process.env.HARNESS_TEMPLATES_ROOT) return process.env.HARNESS_TEMPLATES_ROOT;
  // __dirname = packages/project-spawner/src
  return path.resolve(__dirname, '..', '..', '..', 'templates');
}

/**
 * Resolve the path to a named template under templatesRoot.
 */
function resolveTemplatePath(templatesRoot, templateName) {
  return path.join(templatesRoot, templateName);
}

/**
 * Validate that a template directory exists.
 * Returns { ok: true } or { ok: false, error: string }.
 */
async function validateTemplate(templatesRoot, templateName) {
  const templatePath = resolveTemplatePath(templatesRoot, templateName);
  try {
    const stat = await fsp.stat(templatePath);
    if (!stat.isDirectory()) {
      return { ok: false, error: `Template path exists but is not a directory: ${templatePath}` };
    }
    return { ok: true, templatePath };
  } catch {
    return {
      ok: false,
      error: `Template "${templateName}" not found at ${templatePath}`,
    };
  }
}

/**
 * Recursively copy a directory while skipping common build artefacts.
 */
async function copyTemplate(srcDir, destDir) {
  const SKIP_NAMES = new Set([
    'node_modules',
    '.git',
    '.next',
    'dist',
    'build',
    '.turbo',
    '.cache',
  ]);

  await fsp.mkdir(destDir, { recursive: true });
  const entries = await fsp.readdir(srcDir, { withFileTypes: true });

  for (const entry of entries) {
    if (SKIP_NAMES.has(entry.name)) continue;
    const from = path.join(srcDir, entry.name);
    const to = path.join(destDir, entry.name);

    if (entry.isDirectory()) {
      await copyTemplate(from, to);
    } else if (entry.isSymbolicLink()) {
      const target = await fsp.readlink(from);
      await fsp.symlink(target, to);
    } else {
      await fsp.copyFile(from, to);
    }
  }
}

/**
 * Initialize a fresh git repo in `targetDir`.
 * Best-effort: returns { ok, message } and never throws.
 */
function initGitRepo(targetDir) {
  try {
    const result = spawnSync('git', ['init', '-q'], {
      cwd: targetDir,
      shell: process.platform === 'win32',
      stdio: 'ignore',
    });
    if (result.status === 0) return { ok: true };
    return { ok: false, message: `git init exited with code ${result.status}` };
  } catch (err) {
    return { ok: false, message: err.message };
  }
}

/**
 * Locate the user's age public key file. Returns the absolute path or null.
 */
function getAgeKeyPath() {
  const home = os.homedir();
  return path.join(home, '.config', 'sops', 'age', 'keys.txt');
}

/**
 * Read the public key out of a `keys.txt` file written by `age-keygen`.
 * Returns the public key string ("age1...") or null.
 */
async function readAgePublicKey(keyPath) {
  try {
    const text = await fsp.readFile(keyPath, 'utf8');
    const match = text.match(/^# public key:\s*(age1[\w]+)/m);
    if (match) return match[1];
    // Fallback: derive via age-keygen -y
    const r = spawnSync('age-keygen', ['-y', keyPath], {
      shell: process.platform === 'win32',
      encoding: 'utf8',
    });
    if (r.status === 0 && r.stdout) return r.stdout.trim().split(/\r?\n/).pop();
    return null;
  } catch {
    return null;
  }
}

/**
 * Ensure the user has an age key. If missing, generate one and return its public key.
 * Returns { publicKey: string|null, generated: boolean, keyPath: string }.
 */
async function ensureAgeKey({ runner = spawnSync } = {}) {
  const keyPath = getAgeKeyPath();
  if (fs.existsSync(keyPath)) {
    const publicKey = await readAgePublicKey(keyPath);
    return { publicKey, generated: false, keyPath };
  }

  // Generate key
  await fsp.mkdir(path.dirname(keyPath), { recursive: true });
  const r = runner('age-keygen', ['-o', keyPath], {
    shell: process.platform === 'win32',
    encoding: 'utf8',
  });
  if (r.status !== 0) {
    return { publicKey: null, generated: false, keyPath, error: r.stderr || 'age-keygen failed' };
  }
  const publicKey = await readAgePublicKey(keyPath);
  return { publicKey, generated: true, keyPath };
}

/**
 * Write a fresh `.env.sops` skeleton encrypted to the user's age key
 * (or a placeholder file if sops/age aren't available).
 */
async function writeEnvSopsSkeleton(targetDir, agePublicKey) {
  const skeletonPath = path.join(targetDir, '.env.sops');
  const placeholder = [
    '# .env.sops - encrypted environment variables',
    '#',
    '# Edit with: sops .env.sops',
    '# Decrypt with: sops -d .env.sops > .env',
    '#',
    agePublicKey
      ? `# Encrypted to age public key: ${agePublicKey}`
      : '# WARNING: no age public key resolved; this file is a plaintext placeholder.',
    '',
    'EXAMPLE_KEY=replace-me',
    '',
  ].join('\n');

  await fsp.writeFile(skeletonPath, placeholder, 'utf8');

  // Best-effort: try real sops encryption when both `sops` and the public key are available.
  if (agePublicKey) {
    const r = spawnSync(
      'sops',
      ['--encrypt', '--age', agePublicKey, '--in-place', skeletonPath],
      {
        shell: process.platform === 'win32',
        stdio: 'ignore',
      },
    );
    if (r.status !== 0) {
      // sops not installed or failed - leave the plaintext placeholder.
      return { encrypted: false, path: skeletonPath };
    }
    return { encrypted: true, path: skeletonPath };
  }

  return { encrypted: false, path: skeletonPath };
}

/**
 * Filter the per-CLI context files in `targetDir` based on the chosen aiCli.
 *
 * If `aiCli` is "all" or omitted, all three files (CLAUDE.md, AGENTS.md, GEMINI.md)
 * are kept if they exist. Otherwise, only the matching one is kept and the others
 * are removed if present.
 */
async function applyAiCliFilter(targetDir, aiCli) {
  const all = Object.values(AI_CLI_FILE_MAP);
  const keep = aiCli === 'all' ? new Set(all) : new Set([AI_CLI_FILE_MAP[aiCli]]);

  const removed = [];
  for (const filename of all) {
    if (keep.has(filename)) continue;
    const p = path.join(targetDir, filename);
    if (fs.existsSync(p)) {
      await fsp.rm(p, { force: true });
      removed.push(filename);
    }
  }
  return { kept: [...keep], removed };
}

/**
 * Print "Open in container" instructions on success.
 */
function printSuccess({ projectName, targetDir, agePublicKey, agePathInfo }) {
  /* eslint-disable no-console */
  console.log('');
  console.log(chalk.green(`Created ${projectName} at ${targetDir}`));
  console.log('');
  console.log(chalk.bold('Open in container:'));
  console.log(`  cd ${projectName}`);
  console.log('  code .   # then: "Reopen in Container" (Dev Containers extension)');
  console.log('');
  if (agePublicKey) {
    console.log(chalk.bold('Your age public key (share for encrypted secrets):'));
    console.log('  ' + agePublicKey);
  } else if (agePathInfo) {
    console.log(chalk.yellow(`No age key resolved at ${agePathInfo}.`));
    console.log('  Install age and run: age-keygen -o ~/.config/sops/age/keys.txt');
  }
  console.log('');
  /* eslint-enable no-console */
}

/**
 * Top-level run function. Exposed so tests can drive it directly without
 * spawning a subprocess.
 *
 * @param {object} args
 * @param {string} args.template     template name to scaffold from
 * @param {string} args.projectName  destination directory name (relative to cwd)
 * @param {string} [args.aiCli]      claude|codex|gemini|all (default: all)
 * @param {string} [args.cwd]        override current working directory
 * @param {string} [args.templatesRoot] override templates root
 */
async function run(args) {
  const cwd = args.cwd || process.cwd();
  const aiCli = args.aiCli || 'all';

  if (!args.template || !args.projectName) {
    return { ok: false, code: 1, error: 'Both <template-name> and <project-name> are required.' };
  }

  if (!SUPPORTED_AI_CLIS.includes(aiCli)) {
    return {
      ok: false,
      code: 1,
      error: `Unsupported --ai-cli value "${aiCli}". Use one of: ${SUPPORTED_AI_CLIS.join(', ')}`,
    };
  }

  const templatesRoot = resolveTemplatesRoot({ templatesRoot: args.templatesRoot });
  const v = await validateTemplate(templatesRoot, args.template);
  if (!v.ok) return { ok: false, code: 2, error: v.error };

  const targetDir = path.resolve(cwd, args.projectName);
  if (fs.existsSync(targetDir)) {
    return {
      ok: false,
      code: 3,
      error: `Target directory already exists: ${targetDir}`,
    };
  }

  await copyTemplate(v.templatePath, targetDir);

  const ai = await applyAiCliFilter(targetDir, aiCli);
  const git = initGitRepo(targetDir);

  let agePublicKey = null;
  let ageKeyPath = getAgeKeyPath();
  if (!args.skipAge) {
    try {
      const ageResult = await ensureAgeKey();
      agePublicKey = ageResult.publicKey;
      ageKeyPath = ageResult.keyPath;
    } catch {
      // age tools not installed - skip silently, write plaintext skeleton
    }
  }

  const env = await writeEnvSopsSkeleton(targetDir, agePublicKey);

  return {
    ok: true,
    code: 0,
    targetDir,
    template: args.template,
    aiCli,
    aiFiltered: ai,
    git,
    env,
    agePublicKey,
    ageKeyPath,
  };
}

/**
 * CLI entrypoint. Parses argv with cac and delegates to `run`.
 */
async function main(argv = process.argv) {
  const cli = cac('harness-spawn');

  cli
    .command('<template> <project-name>', 'Scaffold a new project from a template')
    .option('--ai-cli <name>', 'Which AI CLI context file(s) to ship: claude|codex|gemini|all', {
      default: 'all',
    })
    .option('--skip-age', 'Skip age key generation/lookup (useful in CI)')
    .action(async (template, projectName, options) => {
      const result = await run({
        template,
        projectName,
        aiCli: options.aiCli,
        skipAge: !!options.skipAge,
      });

      if (!result.ok) {
        // eslint-disable-next-line no-console
        console.error(chalk.red(`Error: ${result.error}`));
        process.exit(result.code || 1);
      }

      printSuccess({
        projectName,
        targetDir: result.targetDir,
        agePublicKey: result.agePublicKey,
        agePathInfo: result.ageKeyPath,
      });
    });

  cli.help();
  cli.version(PKG_VERSION);

  // No-arg invocation should print help and exit 0.
  if (argv.length <= 2) {
    cli.outputHelp();
    return;
  }

  try {
    cli.parse(argv, { run: false });
    await cli.runMatchedCommand();
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(chalk.red(`Error: ${err.message}`));
    process.exit(1);
  }
}

module.exports = {
  PKG_NAME,
  PKG_VERSION,
  SUPPORTED_AI_CLIS,
  AI_CLI_FILE_MAP,
  resolveTemplatesRoot,
  resolveTemplatePath,
  validateTemplate,
  copyTemplate,
  initGitRepo,
  getAgeKeyPath,
  readAgePublicKey,
  ensureAgeKey,
  writeEnvSopsSkeleton,
  applyAiCliFilter,
  run,
  main,
};

if (require.main === module) {
  main(process.argv).catch((err) => {
    // eslint-disable-next-line no-console
    console.error(chalk.red(`Fatal: ${err && err.stack ? err.stack : err}`));
    process.exit(1);
  });
}
