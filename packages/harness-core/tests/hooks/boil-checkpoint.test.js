/**
 * Tests for scripts/hooks/boil-checkpoint.js — Boil-the-Ocean Layer 2.
 *
 * Run with: node tests/hooks/boil-checkpoint.test.js
 */

'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const hookPath = path.join(__dirname, '..', '..', 'scripts', 'hooks', 'boil-checkpoint.js');
const { run, resolveBoilReviewPath, buildArgs } = require(hookPath);

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.log(`  ✗ ${name}`);
    console.log(`    Error: ${err.message}`);
    failed++;
  }
}

function withTempDir(fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'boil-checkpoint-'));
  try {
    return fn(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function withEnv(overrides, fn) {
  const original = {};
  for (const key of Object.keys(overrides)) {
    original[key] = process.env[key];
    if (overrides[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = overrides[key];
    }
  }
  try {
    return fn();
  } finally {
    for (const key of Object.keys(original)) {
      if (original[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = original[key];
      }
    }
  }
}

console.log('\n=== Testing boil-checkpoint.js ===\n');

console.log('Module surface:');

test('exports run function', () => {
  assert.strictEqual(typeof run, 'function');
});

test('exports resolveBoilReviewPath function', () => {
  assert.strictEqual(typeof resolveBoilReviewPath, 'function');
});

test('exports buildArgs function', () => {
  assert.strictEqual(typeof buildArgs, 'function');
});

console.log('\nresolveBoilReviewPath:');

test('honors BOIL_REVIEW_PATH env override', () => {
  withEnv({ BOIL_REVIEW_PATH: '/tmp/custom-boil.js' }, () => {
    const resolved = resolveBoilReviewPath('/some/plugin/root');
    assert.strictEqual(resolved, path.resolve('/tmp/custom-boil.js'));
  });
});

test('falls back to ../../tools/boil-review.js relative to plugin root', () => {
  withEnv({ BOIL_REVIEW_PATH: undefined }, () => {
    const resolved = resolveBoilReviewPath('/repo/packages/harness-core');
    assert.strictEqual(
      path.normalize(resolved),
      path.normalize(path.resolve('/repo/packages/harness-core/../../tools/boil-review.js'))
    );
  });
});

console.log('\nbuildArgs:');

test('passes --quick to boil-review.js', () => {
  const args = buildArgs('/x/tools/boil-review.js');
  assert.deepStrictEqual(args, ['/x/tools/boil-review.js', '--quick']);
});

console.log('\nrun(): missing script fallback:');

test('returns exit 0 + warning when boil-review.js is missing', () => {
  withEnv({ BOIL_REVIEW_PATH: '/definitely/does/not/exist/boil-review.js' }, () => {
    const out = run('{"tool":"Write"}', {});
    assert.strictEqual(out.exitCode, 0, 'must never block tool execution');
    assert.ok(out.stderr.includes('[BoilCheckpoint]'), 'stderr should be prefixed');
    assert.ok(
      out.stderr.includes('not found') || out.stderr.includes('skipping'),
      'stderr should explain the skip'
    );
    assert.strictEqual(out.stdout, '{"tool":"Write"}', 'raw input should pass through unchanged');
  });
});

console.log('\nrun(): script invocation success path:');

test('captures script stdout into [BoilCheckpoint] note on stderr', () => {
  withTempDir(dir => {
    const stub = path.join(dir, 'boil-review.js');
    fs.writeFileSync(stub, "process.stdout.write('checklist OK');\nprocess.exit(0);\n");
    withEnv({ BOIL_REVIEW_PATH: stub }, () => {
      const out = run('{"tool":"Edit"}', {});
      assert.strictEqual(out.exitCode, 0);
      assert.strictEqual(out.stdout, '{"tool":"Edit"}');
      assert.ok(out.stderr.includes('[BoilCheckpoint]'), 'should prefix output');
      assert.ok(out.stderr.includes('checklist OK'), 'should include script stdout');
    });
  });
});

console.log('\nrun(): script failure fallback:');

test('exit-non-zero from boil-review.js does not block the tool', () => {
  withTempDir(dir => {
    const stub = path.join(dir, 'boil-review.js');
    fs.writeFileSync(
      stub,
      "process.stderr.write('boom');\nprocess.exit(7);\n"
    );
    withEnv({ BOIL_REVIEW_PATH: stub }, () => {
      const out = run('{"tool":"MultiEdit"}', {});
      assert.strictEqual(out.exitCode, 0, 'must never block tool execution');
      assert.strictEqual(out.stdout, '{"tool":"MultiEdit"}');
      assert.ok(out.stderr.includes('[BoilCheckpoint]'));
      assert.ok(
        out.stderr.includes('failed') || out.stderr.includes('boom'),
        'stderr should explain the failure'
      );
    });
  });
});

console.log(`\nResults: Passed: ${passed}, Failed: ${failed}`);
process.exit(failed > 0 ? 1 : 0);
