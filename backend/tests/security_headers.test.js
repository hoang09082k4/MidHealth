import test from 'node:test';
import assert from 'node:assert/strict';
import { applySecurityHeaders } from '../src/security_headers.js';

function createHeaderRecorder() {
  const headers = new Map();
  return {
    headers,
    response: {
      setHeader(name, value) {
        headers.set(name, value);
      },
    },
  };
}

test('applies baseline API security headers', () => {
  const { headers, response } = createHeaderRecorder();
  applySecurityHeaders(response);

  assert.equal(headers.get('X-Content-Type-Options'), 'nosniff');
  assert.equal(headers.get('X-Frame-Options'), 'DENY');
  assert.equal(headers.get('Referrer-Policy'), 'strict-origin-when-cross-origin');
  assert.equal(headers.get('Permissions-Policy'), 'camera=(), microphone=(), geolocation=()');
  assert.equal(headers.get('Cache-Control'), 'no-store');
});
