import test from 'node:test';
import assert from 'node:assert/strict';

process.env.VERCEL = '1';

const { handleRequest } = await import('../src/server.js');

function mockRequest(pathname) {
  return {
    method: 'GET',
    url: pathname,
    headers: {
      host: 'midhealth.vercel.app',
      origin: 'https://midhealth.vercel.app',
      'x-forwarded-proto': 'https',
    },
  };
}

function mockResponse() {
  return {
    statusCode: 0,
    headers: {},
    body: '',
    setHeader(name, value) {
      this.headers[name] = value;
    },
    writeHead(statusCode, headers = {}) {
      this.statusCode = statusCode;
      this.headers = { ...this.headers, ...headers };
    },
    end(body = '') {
      this.body = body;
    },
  };
}

test('public API reads are routed by the backend handler', async () => {
  const paths = [
    '/api/reference-data',
    '/api/catalog',
    '/api/auth/me?portal=patient&allowIncomplete=1&optional=1',
    '/api/health/articles?category=suc-khoe-tong-quat&limit=8',
    '/api/health/experts',
  ];

  for (const pathname of paths) {
    const response = mockResponse();
    await handleRequest(mockRequest(pathname), response);
    assert.notEqual(response.statusCode, 404, pathname);
  }
});
