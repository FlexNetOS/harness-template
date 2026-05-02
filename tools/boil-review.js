#!/usr/bin/env node
// boil-review.js
//
// "Boil-the-ocean" code review utility derived from garrys-mega-plan.md.
//
// Modes:
//   --quick   Fast (<200ms) prompt injector for the PreToolUse hook. Emits the
//             10-section checklist as structured context that Claude consumes
//             on the next turn. No diff parsing — just the framework.
//   --full    Heavy CI-grade sweep. Runs each of the 10 sections against a
//             diff (default: `git diff --staged` or whatever --diff-file points
//             to) using simple regex/heuristic stub checks. Each section is
//             clearly marked as a starter implementation (see TODOs below) so
//             follow-up work can deepen the analyses without rewriting the
//             scaffolding.
//
// Output:
//   --json     Emit structured JSON.
//   (default)  Emit structured Markdown.
//
// Exit codes:
//   0 = clean (no findings or info-only)
//   1 = warnings only (non-blocking)
//   2 = critical gaps (CI-blocking)
//
// Required deps (Node built-ins only — declare in root package.json if
// expanded later):
//   none beyond Node >=20 stdlib (child_process, fs, path).
//
// Usage examples:
//   node tools/boil-review.js --quick
//   node tools/boil-review.js --full
//   node tools/boil-review.js --full --json --diff-file /tmp/pr.diff
//
// CommonJS — keep parity with the rest of tools/.

'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// -----------------------------------------------------------------------------
// 10-section checklist — single source of truth.
// Mirrors the section ordering from garrys-mega-plan.md.
// -----------------------------------------------------------------------------
const SECTIONS = [
  {
    id: 'architecture',
    title: 'Architecture',
    prompt:
      'Evaluate component boundaries, data flow (happy/nil/empty/error), state machines, ' +
      'coupling, scaling, single points of failure, security architecture, production failure ' +
      'scenarios, and rollback posture. ASCII-diagram every new flow.',
  },
  {
    id: 'errors',
    title: 'Errors & Rescue Map',
    prompt:
      'Build the error/rescue table for every new codepath. Name the exception class, ' +
      'rescue action, and what the user sees. `rescue StandardError` is a smell — flag it.',
  },
  {
    id: 'security',
    title: 'Security & Threat Model',
    prompt:
      'Map attack surface expansion, input validation, authorization, secrets, dependency ' +
      'risk, data classification, injection vectors (SQL, command, template, LLM prompt), ' +
      'and audit logging. Score threat × likelihood × impact.',
  },
  {
    id: 'data-flow',
    title: 'Data Flow & Interaction Edge Cases',
    prompt:
      'Trace every new data flow with shadow paths (nil/empty/error). Map interaction edge ' +
      'cases: double-click, navigate-away, stale state, timeouts, retries, dup jobs.',
  },
  {
    id: 'code-quality',
    title: 'Code Quality',
    prompt:
      'Module structure, DRY violations, naming, error-handling patterns, missing edge cases, ' +
      'over- and under-engineering, cyclomatic complexity (>5 branches per method).',
  },
  {
    id: 'tests',
    title: 'Tests',
    prompt:
      'For every new flow: unit, integration, edge-case, and failure-mode coverage. ' +
      'Diagram the test surface; flag untested branches.',
  },
  {
    id: 'performance',
    title: 'Performance',
    prompt:
      'N+1 queries, hot loops, allocation pressure, blocking I/O on request paths, ' +
      'cache invalidation, pagination behavior under 10x and 100x load.',
  },
  {
    id: 'observability',
    title: 'Observability & Debuggability',
    prompt:
      'Logs (with full context, not just messages), metrics, traces, dashboards, alerts, ' +
      'runbooks. Observability is scope, not afterthought.',
  },
  {
    id: 'deployment',
    title: 'Deployment & Rollout',
    prompt:
      'Migration order, deploy order, feature flags, rollback procedure (and timing), ' +
      'partial-state handling, blast radius if it ships broken.',
  },
  {
    id: 'trajectory',
    title: 'Long-Term Trajectory',
    prompt:
      'Optimize for the 6-month future. Does this plan move toward the 12-month ideal or ' +
      'create next quarter\'s nightmare?',
  },
];

// -----------------------------------------------------------------------------
// CLI parsing
// -----------------------------------------------------------------------------
function parseArgs(argv) {
  const args = {
    mode: null,
    json: false,
    diffFile: null,
    diffText: null, // injectable for tests
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--quick') args.mode = 'quick';
    else if (a === '--full') args.mode = 'full';
    else if (a === '--json') args.json = true;
    else if (a === '--diff-file') {
      args.diffFile = argv[++i];
    }
  }
  return args;
}

// -----------------------------------------------------------------------------
// QUICK mode — emit the 10-section prompt as injectable context.
// Format: a structured Markdown block with stable headers Claude can parse.
// Must complete in <200ms — no diff parsing here.
// -----------------------------------------------------------------------------
function runQuick({ json }) {
  if (json) {
    return {
      exitCode: 0,
      output: JSON.stringify(
        {
          kind: 'boil-review.checklist',
          version: '1.0',
          mode: 'quick',
          sections: SECTIONS.map((s) => ({ id: s.id, title: s.title, prompt: s.prompt })),
        },
        null,
        2,
      ),
    };
  }
  const lines = [];
  lines.push('<!-- boil-review.checklist v1.0 mode=quick -->');
  lines.push('# Boil-the-Ocean Review Checklist');
  lines.push('');
  lines.push(
    'Before responding to the next user turn, mentally run the change you are about ' +
      'to propose through these 10 sections. If any are unaddressed, surface them.',
  );
  lines.push('');
  for (let i = 0; i < SECTIONS.length; i++) {
    const s = SECTIONS[i];
    lines.push(`## ${i + 1}. ${s.title}`);
    lines.push(s.prompt);
    lines.push('');
  }
  return { exitCode: 0, output: lines.join('\n') };
}

// -----------------------------------------------------------------------------
// FULL mode — diff-driven heuristic checks.
// Each section returns { findings: [...], severity: 'info'|'warn'|'critical' }.
// Findings are intentionally shallow — clear TODOs flag where to deepen.
// -----------------------------------------------------------------------------

function loadDiff(args) {
  if (args.diffText != null) return args.diffText;
  if (args.diffFile) {
    return fs.readFileSync(args.diffFile, 'utf8');
  }
  // Fall back to staged diff. If git fails (e.g. not a repo), return empty.
  try {
    return execSync('git diff --staged', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  } catch {
    try {
      return execSync('git diff', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    } catch {
      return '';
    }
  }
}

// Split a unified diff into per-file added-line text (lines starting with `+`,
// excluding `+++` headers). Good enough for pattern matching.
function extractAddedLines(diff) {
  const out = [];
  const lines = diff.split(/\r?\n/);
  let currentFile = null;
  for (const line of lines) {
    if (line.startsWith('+++ ')) {
      currentFile = line.replace(/^\+\+\+ [ab]\//, '').trim();
      continue;
    }
    if (line.startsWith('--- ')) continue;
    if (line.startsWith('+') && !line.startsWith('+++')) {
      out.push({ file: currentFile, text: line.slice(1) });
    }
  }
  return out;
}

// Section runners — each is a stub. Severity: info | warn | critical.
const SECTION_RUNNERS = {
  architecture(added) {
    // TODO: deepen — actually parse imports/exports, build dep graph deltas,
    // detect new top-level modules or coupling additions.
    const findings = [];
    const newModules = added.filter((a) => /\bclass\s+\w+|\bmodule\.exports\s*=/.test(a.text));
    if (newModules.length > 0) {
      findings.push({
        kind: 'info',
        message: `${newModules.length} new module/class declarations — verify dependency graph and rollback story.`,
      });
    }
    return { findings, severity: 'info' };
  },
  errors(added) {
    // TODO: deepen — track try/catch pairs, identify rescued exception classes,
    // detect swallow-and-continue patterns.
    const findings = [];
    for (const a of added) {
      if (/catch\s*\(\s*\w*\s*\)\s*\{\s*\}/.test(a.text)) {
        findings.push({
          kind: 'critical',
          file: a.file,
          message: 'Empty catch block — silent failure. Section 2 violation.',
        });
      }
      if (/rescue\s+StandardError/.test(a.text) || /catch\s*\(\s*Error\s+/.test(a.text)) {
        findings.push({
          kind: 'warn',
          file: a.file,
          message: 'Broad rescue/catch — name the specific exception class.',
        });
      }
    }
    const severity = findings.some((f) => f.kind === 'critical')
      ? 'critical'
      : findings.length
      ? 'warn'
      : 'info';
    return { findings, severity };
  },
  security(added) {
    // TODO: deepen — proper AST scan, dependency-tree review, secret-scanner integration.
    const findings = [];
    const secretPatterns = [
      { re: /(?:api[_-]?key|secret|token|password)\s*[:=]\s*['"][A-Za-z0-9/_+\-]{12,}/i, label: 'hardcoded credential' },
      { re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/, label: 'private key' },
    ];
    for (const a of added) {
      for (const p of secretPatterns) {
        if (p.re.test(a.text)) {
          findings.push({
            kind: 'critical',
            file: a.file,
            message: `Possible ${p.label} in diff. Move to env var or secret manager.`,
          });
        }
      }
      if (/exec(Sync)?\s*\(\s*[`"'][^`"']*\$\{/.test(a.text)) {
        findings.push({
          kind: 'warn',
          file: a.file,
          message: 'String-interpolated shell command — potential injection vector.',
        });
      }
    }
    const severity = findings.some((f) => f.kind === 'critical')
      ? 'critical'
      : findings.length
      ? 'warn'
      : 'info';
    return { findings, severity };
  },
  'data-flow'(added) {
    // TODO: deepen — trace function call graphs, identify unguarded nil/empty paths.
    const findings = [];
    for (const a of added) {
      if (/\.\s*length\s*===?\s*0/.test(a.text)) {
        findings.push({
          kind: 'info',
          file: a.file,
          message: 'Empty-collection check spotted — confirm the nil branch is also handled.',
        });
      }
    }
    return { findings, severity: 'info' };
  },
  'code-quality'(added) {
    // TODO: deepen — real cyclomatic complexity, DRY detection, naming heuristics.
    const findings = [];
    for (const a of added) {
      if (/\bvar\s+/.test(a.text)) {
        findings.push({
          kind: 'warn',
          file: a.file,
          message: '`var` used — prefer const/let.',
        });
      }
      if (/\/\/\s*(TODO|FIXME|HACK|XXX)\b/i.test(a.text)) {
        findings.push({
          kind: 'info',
          file: a.file,
          message: 'TODO/FIXME added — ensure it is logged in TODOS.md.',
        });
      }
    }
    const severity = findings.some((f) => f.kind === 'warn') ? 'warn' : 'info';
    return { findings, severity };
  },
  tests(added) {
    // TODO: deepen — match new source files against test file presence,
    // diff coverage reports.
    const findings = [];
    const sourceTouched = added.some(
      (a) => a.file && /\.(js|ts|rb|py|go)$/.test(a.file) && !/test|spec/.test(a.file),
    );
    const testTouched = added.some((a) => a.file && /(test|spec)/.test(a.file));
    if (sourceTouched && !testTouched) {
      findings.push({
        kind: 'warn',
        message: 'Source files changed without matching test changes.',
      });
    }
    return { findings, severity: findings.length ? 'warn' : 'info' };
  },
  performance(added) {
    // TODO: deepen — N+1 detection, hot-loop analysis, allocation patterns.
    const findings = [];
    for (const a of added) {
      if (/\.forEach\s*\([^)]*\)\s*\.\s*forEach/.test(a.text)) {
        findings.push({
          kind: 'warn',
          file: a.file,
          message: 'Nested forEach — possible quadratic loop.',
        });
      }
    }
    return { findings, severity: findings.length ? 'warn' : 'info' };
  },
  observability(added) {
    // TODO: deepen — verify log/metric/trace coverage on new branches.
    const findings = [];
    const newCatches = added.filter((a) => /catch\s*\(/.test(a.text)).length;
    const newLogs = added.filter((a) => /console\.|logger\.|log\./.test(a.text)).length;
    if (newCatches > 0 && newLogs === 0) {
      findings.push({
        kind: 'warn',
        message: 'New catch blocks without matching log statements — silent recovery risk.',
      });
    }
    return { findings, severity: findings.length ? 'warn' : 'info' };
  },
  deployment(added) {
    // TODO: deepen — detect migration files, feature flags, infra changes.
    const findings = [];
    const migrationLike = added.some(
      (a) => a.file && /migration|migrate|schema/i.test(a.file),
    );
    if (migrationLike) {
      findings.push({
        kind: 'warn',
        message: 'Migration-like file detected — verify deploy order and rollback procedure.',
      });
    }
    return { findings, severity: findings.length ? 'warn' : 'info' };
  },
  trajectory(_added) {
    // TODO: deepen — needs project context; for now this is a reminder-only stub.
    return {
      findings: [
        {
          kind: 'info',
          message: 'Trajectory check is reminder-only — confirm 6-month implications by hand.',
        },
      ],
      severity: 'info',
    };
  },
};

function severityRank(s) {
  return { info: 0, warn: 1, critical: 2 }[s] ?? 0;
}

function runFull(args) {
  const diff = loadDiff(args);
  const added = extractAddedLines(diff);
  const sectionResults = [];
  let maxSeverity = 'info';
  for (const section of SECTIONS) {
    const runner = SECTION_RUNNERS[section.id];
    const result = runner ? runner(added) : { findings: [], severity: 'info' };
    if (severityRank(result.severity) > severityRank(maxSeverity)) maxSeverity = result.severity;
    sectionResults.push({ id: section.id, title: section.title, ...result });
  }

  const exitCode = maxSeverity === 'critical' ? 2 : maxSeverity === 'warn' ? 1 : 0;

  if (args.json) {
    return {
      exitCode,
      output: JSON.stringify(
        {
          kind: 'boil-review.report',
          version: '1.0',
          mode: 'full',
          severity: maxSeverity,
          diffLinesAdded: added.length,
          sections: sectionResults,
        },
        null,
        2,
      ),
    };
  }

  const lines = [];
  lines.push('# Boil-the-Ocean Review Report');
  lines.push('');
  lines.push(`Overall severity: **${maxSeverity}**  |  Added lines analyzed: ${added.length}`);
  lines.push('');
  for (let i = 0; i < sectionResults.length; i++) {
    const s = sectionResults[i];
    lines.push(`## ${i + 1}. ${s.title} — ${s.severity}`);
    if (!s.findings.length) {
      lines.push('_No findings._');
    } else {
      for (const f of s.findings) {
        const loc = f.file ? ` (${f.file})` : '';
        lines.push(`- **${f.kind}**${loc}: ${f.message}`);
      }
    }
    lines.push('');
  }
  lines.push('---');
  lines.push('Exit code: ' + exitCode);
  return { exitCode, output: lines.join('\n') };
}

// -----------------------------------------------------------------------------
// Entry
// -----------------------------------------------------------------------------
function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (!args.mode) {
    process.stderr.write('Usage: boil-review.js (--quick|--full) [--json] [--diff-file PATH]\n');
    return { exitCode: 64, output: '' };
  }
  return args.mode === 'quick' ? runQuick(args) : runFull(args);
}

if (require.main === module) {
  const { exitCode, output } = main();
  if (output) process.stdout.write(output + '\n');
  process.exit(exitCode);
}

module.exports = {
  SECTIONS,
  parseArgs,
  runQuick,
  runFull,
  extractAddedLines,
  main,
};
