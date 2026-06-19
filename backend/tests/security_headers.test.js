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
  assert.equal(headers.get('X-XSS-Protection'), '0');
  assert.equal(headers.get('X-Frame-Options'), 'DENY');
  assert.equal(headers.get('Referrer-Policy'), 'strict-origin-when-cross-origin');
  assert.equal(headers.get('Permissions-Policy'), 'camera=(), microphone=(), geolocation=(), payment=(), usb=()');
  assert.equal(headers.get('Cross-Origin-Opener-Policy'), 'same-origin');
  assert.equal(headers.get('Cross-Origin-Resource-Policy'), 'same-origin');
  assert.equal(headers.get('Content-Security-Policy'), "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'");
  assert.equal(headers.get('Cache-Control'), 'no-store');
  assert.equal(headers.get('Pragma'), 'no-cache');
  assert.equal(headers.get('Expires'), '0');
});

test('applies HSTS for HTTPS requests', () => {
  const { headers, response } = createHeaderRecorder();
  applySecurityHeaders(response, { headers: { 'x-forwarded-proto': 'https' } });

  assert.equal(headers.get('Strict-Transport-Security'), 'max-age=63072000; includeSubDomains; preload');
});
