import test from 'node:test';
import assert from 'node:assert/strict';
import { adminApiRequest, requireCompletePasswordReset } from '../src/lib/admin_api.js';

for (const [status, message] of [
  [401, 'Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại.'],
  [403, 'Tài khoản hiện tại không có quyền thực hiện thao tác này.'],
  [404, 'Không tìm thấy tài khoản hoặc API được yêu cầu.'],
  [409, 'Tài khoản hoặc yêu cầu hiện không đủ điều kiện để thực hiện thao tác.'],
  [422, 'Thông tin gửi lên chưa hợp lệ. Hãy kiểm tra lại.'],
  [500, 'Backend gặp lỗi khi xử lý yêu cầu. Hãy thử lại sau.'],
]) {
  test(`admin API surfaces HTTP ${status} as an error, never as success`, async () => {
    const result = adminApiRequest('/api/admin/users/id/password-reset', 'token', {}, async () => new Response('{}', { status }));
    await assert.rejects(result, error => error.message === message && error.status === status);
  });
}

test('admin API prioritizes the backend error message', async () => {
  const result = adminApiRequest('/api/admin/users/id/password-reset', 'token', {}, async () => new Response(
    JSON.stringify({ message: 'Firebase Admin credential chưa được cấu hình.' }),
    { status: 503, headers: { 'Content-Type': 'application/json' } },
  ));
  await assert.rejects(result, error => error.message === 'Firebase Admin credential chưa được cấu hình.');
});

test('admin API sends the authenticated request and returns successful response data', async () => {
  let request;
  const result = await adminApiRequest('/api/admin/users/id/password-reset', 'admin-token', {
    method: 'POST',
    body: JSON.stringify({ password: 'new-secure-password' }),
  }, async (url, options) => {
    request = { url, options };
    return new Response(JSON.stringify({ data: { email: 'doctor@example.test', sessionsRevoked: true } }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    });
  });
  assert.equal(request.url, '/api/admin/users/id/password-reset');
  assert.equal(request.options.headers.Authorization, 'Bearer admin-token');
  assert.deepEqual(result, { email: 'doctor@example.test', sessionsRevoked: true });
});

test('frontend reports reset success only when backend confirms Firebase update and old-session revocation', () => {
  assert.deepEqual(requireCompletePasswordReset({ email: 'doctor@example.test', sessionsRevoked: true }), {
    email: 'doctor@example.test', sessionsRevoked: true,
  });
  assert.throws(() => requireCompletePasswordReset(null), /Không thể báo reset thành công/);
  assert.throws(() => requireCompletePasswordReset({ email: 'doctor@example.test', sessionsRevoked: false }), /Không thể báo reset thành công/);
});
