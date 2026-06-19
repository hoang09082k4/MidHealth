import test from 'node:test';
import assert from 'node:assert/strict';
import { isCorsOriginAllowed, normalizeCorsOrigin } from '../src/cors.js';

test('normalizes CORS origins consistently', () => {
  assert.equal(normalizeCorsOrigin('http://localhost:5173/'), 'http://localhost:5173');
  assert.equal(normalizeCorsOrigin('https://midhealth.vercel.app///'), 'https://midhealth.vercel.app');
  assert.equal(normalizeCorsOrigin(''), '');
});

test('allows configured and local origins', () => {
  assert.equal(isCorsOriginAllowed('http://localhost:5173'), true);
  assert.equal(isCorsOriginAllowed('http://127.0.0.1:4173'), true);
  assert.equal(isCorsOriginAllowed('https://midhealth.vercel.app'), true);
});

test('blocks unrelated origins', () => {
  assert.equal(isCorsOriginAllowed('https://example.com'), false);
  assert.equal(isCorsOriginAllowed('https://feature-branch.vercel.app'), false);
  assert.equal(isCorsOriginAllowed('https://midhealth.vercel.app.evil.example'), false);
});

test('allows Vercel preview origins only when explicitly enabled', () => {
  const previous = process.env.ALLOW_VERCEL_PREVIEW_ORIGINS;
  process.env.ALLOW_VERCEL_PREVIEW_ORIGINS = 'true';
  try {
    assert.equal(isCorsOriginAllowed('https://feature-branch.vercel.app'), true);
  } finally {
    if (previous === undefined) {
      delete process.env.ALLOW_VERCEL_PREVIEW_ORIGINS;
    } else {
      process.env.ALLOW_VERCEL_PREVIEW_ORIGINS = previous;
    }
  }
});
