import test from 'node:test';
import assert from 'node:assert/strict';

const { handleRequest } = await import('../src/server.js');

function mockRequest(pathname) {
  return {
    method: 'GET',
    url: pathname,
    headers: {
      host: 'localhost:4000',
      origin: 'http://localhost:5173',
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
  ];

  for (const pathname of paths) {
    const response = mockResponse();
    await handleRequest(mockRequest(pathname), response);
    assert.notEqual(response.statusCode, 404, pathname);
    assert.ok(response.statusCode >= 200 && response.statusCode < 300, pathname);
  }
});

test('retired health news endpoints are unavailable', async () => {
  for (const pathname of ['/api/health/articles', '/api/health-news/articles', '/api/admin/health-articles']) {
    const response = mockResponse();
    await handleRequest(mockRequest(pathname), response);
    assert.equal(response.statusCode, 404, pathname);
  }
});

test('retired AI assistant endpoint is unavailable', async () => {
  const response = mockResponse();
  await handleRequest({ ...mockRequest('/api/chatbot'), method: 'POST' }, response);
  assert.equal(response.statusCode, 404);
});

test('single clinic endpoints work and marketplace endpoints are removed', async () => {
  for (const pathname of ['/api/clinic', '/api/doctors', '/api/specialties', '/api/services']) {
    const response = mockResponse(); await handleRequest(mockRequest(pathname), response); assert.equal(response.statusCode, 200, pathname);
  }
  for (const pathname of ['/api/clinics', '/api/hospitals', '/api/clinics/example/slots', '/api/provider/workspace', '/api/provider/workspace/operations']) {
    const response = mockResponse(); await handleRequest(mockRequest(pathname), response); assert.equal(response.statusCode, 404, pathname);
  }
});

test('admin schedule is protected before database access', async () => {
  const response = mockResponse();
  await handleRequest(mockRequest('/api/admin/doctors/11111111-1111-4111-8111-111111111111/slots'), response);
  assert.equal(response.statusCode, 401);
});

test('admin audit events are protected before database access', async () => {
  const response = mockResponse();
  await handleRequest(mockRequest('/api/admin/audit-events?page=1&pageSize=50'), response);
  assert.equal(response.statusCode, 401);
});

test('admin account password reset is protected before Firebase access', async () => {
  const response = mockResponse();
  await handleRequest({
    ...mockRequest('/api/admin/users/11111111-1111-4111-8111-111111111111/password-reset'),
    method: 'POST',
  }, response);
  assert.equal(response.statusCode, 401);
});

test('visit check-in and disruption require admin authentication', async () => {
  for (const action of ['check-in', 'disruption', 'reschedule']) {
    const response = mockResponse();
    await handleRequest({ ...mockRequest(`/api/admin/appointments/11111111-1111-4111-8111-111111111111/${action}`), method: 'POST' }, response);
    assert.equal(response.statusCode, 401, action);
  }
  const removed = mockResponse();
  await handleRequest({ ...mockRequest('/api/admin/appointments/11111111-1111-4111-8111-111111111111/complete'), method: 'POST' }, removed);
  assert.equal(removed.statusCode, 404);
  for (const path of ['/api/doctor/workspace', '/api/doctor/slots', '/api/doctor/report']) {
    const response = mockResponse();
    await handleRequest(mockRequest(path), response);
    assert.equal(response.statusCode, 401);
  }
  const createAccount = mockResponse();
  await handleRequest({ ...mockRequest('/api/admin/doctor-accounts'), method: 'POST' }, createAccount);
  assert.equal(createAccount.statusCode, 401);
});

test('only anonymous public reads receive CDN caching', async () => {
  const publicResponse = mockResponse();
  await handleRequest(mockRequest('/api/reference-data'), publicResponse);
  assert.match(publicResponse.headers['Cache-Control'], /s-maxage=300/);

  const authenticatedResponse = mockResponse();
  await handleRequest({ ...mockRequest('/api/reference-data'), headers: { ...mockRequest('/api/reference-data').headers, authorization: 'Bearer example' } }, authenticatedResponse);
  assert.equal(authenticatedResponse.headers['Cache-Control'], 'private, no-store');

  const privateResponse = mockResponse();
  await handleRequest(mockRequest('/api/auth/me?portal=patient&optional=1'), privateResponse);
  assert.equal(privateResponse.headers['Cache-Control'], 'private, no-store');
});
