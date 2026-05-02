// tools/tests/spine-fanout.test.js
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const {
  dispatch,
  mergeResults,
  dedupeFindings,
  dedupeSuggestions,
  VERDICT_RANK,
} = require(path.join('..', 'spine-fanout.js'));

test('dedupeFindings removes duplicates by specialist+title', () => {
  const out = dedupeFindings([
    { specialist: 'sec', title: 'XSS', kind: 'warn' },
    { specialist: 'sec', title: 'XSS', kind: 'warn' },
    { specialist: 'perf', title: 'XSS', kind: 'info' },
  ]);
  assert.equal(out.length, 2);
});

test('dedupeSuggestions deduplicates by case-insensitive trimmed text', () => {
  const out = dedupeSuggestions(['Add a test.', '  add a test.  ', 'Refactor X.']);
  assert.equal(out.length, 2);
});

test('mergeResults picks max severity verdict', () => {
  const merged = mergeResults([
    { specialist: 'a', verdict: 'pass', findings: [], suggestions: [] },
    { specialist: 'b', verdict: 'block', findings: [{ title: 'critical' }], suggestions: [] },
    { specialist: 'c', verdict: 'warn', findings: [], suggestions: [] },
  ]);
  assert.equal(merged.verdict, 'block');
  assert.equal(merged.findings.length, 1);
});

test('mergeResults captures errors per-specialist', () => {
  const merged = mergeResults([
    { specialist: 'a', error: 'boom' },
    { specialist: 'b', verdict: 'pass', findings: [], suggestions: [] },
  ]);
  assert.equal(merged.errors.length, 1);
  assert.equal(merged.errors[0].specialist, 'a');
});

test('VERDICT_RANK orders pass < warn < block', () => {
  assert.ok(VERDICT_RANK.pass < VERDICT_RANK.warn);
  assert.ok(VERDICT_RANK.warn < VERDICT_RANK.block);
});

test('dispatch with empty specialists returns pass', async () => {
  const result = await dispatch({ phase: 'review', specialists: [] });
  assert.equal(result.verdict, 'pass');
  assert.deepEqual(result.findings, []);
});

test('dispatch fans out to mock specialists and merges results', async () => {
  const calls = [];
  const runner = async (specialist) => {
    calls.push(specialist.id);
    if (specialist.id === 'sec') {
      return {
        findings: [{ title: 'leaky-secret', kind: 'critical' }],
        verdict: 'block',
        suggestions: ['Rotate the key.'],
      };
    }
    return { findings: [], verdict: 'pass', suggestions: ['Rotate the key.'] };
  };
  const result = await dispatch({
    phase: 'review',
    specialists: [
      { id: 'sec', brief: 'security check' },
      { id: 'perf', brief: 'perf check' },
    ],
    runner,
  });
  assert.deepEqual(calls.sort(), ['perf', 'sec']);
  assert.equal(result.verdict, 'block');
  assert.equal(result.findings.length, 1);
  // Both specialists submitted the same suggestion — should dedupe.
  assert.equal(result.suggestions.length, 1);
});

test('dispatch tags findings with originating specialist', async () => {
  const runner = async (specialist) => ({
    findings: [{ title: 'thing' }],
    verdict: 'warn',
    suggestions: [],
  });
  const result = await dispatch({
    phase: 'review',
    specialists: [
      { id: 'sec', brief: '' },
      { id: 'perf', brief: '' },
    ],
    runner,
  });
  // Findings should be tagged with their originating specialist.
  const specialists = new Set(result.findings.map((f) => f.specialist));
  assert.deepEqual([...specialists].sort(), ['perf', 'sec']);
});

test('dispatch isolates failures in one specialist', async () => {
  const runner = async (specialist) => {
    if (specialist.id === 'broken') throw new Error('boom');
    return { findings: [], verdict: 'pass', suggestions: [] };
  };
  const result = await dispatch({
    phase: 'review',
    specialists: [
      { id: 'ok', brief: '' },
      { id: 'broken', brief: '' },
    ],
    runner,
  });
  assert.equal(result.errors.length, 1);
  assert.equal(result.errors[0].specialist, 'broken');
  assert.equal(result.verdict, 'pass');
});
