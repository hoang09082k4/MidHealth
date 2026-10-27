import test from 'node:test';
import assert from 'node:assert/strict';
import { isCorsOriginAllowed, normalizeCorsOrigin } from '../src/cors.js';

test('normalizes CORS origins consistently', () => {
  assert.equal(normalizeCorsOrigin('http://localhost:5173/'), 'http://localhost:5173');
  assert.equal(normalizeCorsOrigin('https://clinic.example///'), 'https://clinic.example');
  assert.equal(normalizeCorsOrigin(''), '');
});

test('allows configured and local origins', () => {
  assert.equal(isCorsOriginAllowed('http://localhost:5173'), true);
  assert.equal(isCorsOriginAllowed('http://127.0.0.1:4173'), true);
});

test('blocks unrelated origins', () => {
  assert.equal(isCorsOriginAllowed('https://example.com'), false);
  assert.equal(isCorsOriginAllowed('https://clinic.example.evil.test'), false);
});
