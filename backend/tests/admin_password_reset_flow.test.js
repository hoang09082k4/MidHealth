import test from 'node:test';
import assert from 'node:assert/strict';
import { resetClinicUserPasswordAsAdmin } from '../src/admin_service.js';

const userId = '11111111-1111-4111-8111-111111111111';
const account = {
  id: userId,
  firebase_uid: 'firebase-target-uid',
  email: 'doctor@example.test',
  role: 'doctor',
  auth_provider: 'password',
  status: 'active',
};

function makeClient({ accountRow = account, readError = null } = {}) {
  const queries = [];
  const writes = [];
  return {
    queries,
    writes,
    from(table) {
      const query = {
        table,
        columns: '',
        select(columns) { this.columns = columns; return this; },
        eq(column, value) { this.filter = [column, value]; return this; },
        update(patch) { writes.push(patch); return this; },
        async maybeSingle() {
          queries.push({ table: this.table, columns: this.columns, filter: this.filter });
          return { data: accountRow, error: readError };
        },
      };
      return query;
    },
  };
}

const adminDependencies = (overrides = {}) => ({
  client: makeClient(),
  requireAdmin: async () => ({ ok: true, status: 200, data: { id: 'admin-id' } }),
  updateFirebaseUserPassword: async () => ({ ok: true, status: 200, sessionsRevoked: true }),
  logAdminEvent: async () => {},
  ...overrides,
});

test('admin reset looks up real app_users identity fields and reports Firebase success without returning the password', async () => {
  const client = makeClient();
  const calls = [];
  const result = await resetClinicUserPasswordAsAdmin({}, userId, { password: 'new-secure-password' }, adminDependencies({
    client,
    updateFirebaseUserPassword: async (uid, password, options) => {
      calls.push(['firebase', uid, password, options]);
      return { ok: true, status: 200, sessionsRevoked: true };
    },
    logAdminEvent: async event => calls.push(['audit', event]),
  }));

  assert.equal(result.ok, true);
  assert.equal(result.status, 200);
  assert.equal(result.data.email, account.email);
  assert.equal(result.data.sessionsRevoked, true);
  assert.equal(Object.hasOwn(result.data, 'password'), false);
  assert.deepEqual(client.queries[0], {
    table: 'app_users',
    columns: 'id,firebase_uid,email,role,auth_provider,status',
    filter: ['id', userId],
  });
  assert.deepEqual(client.writes, []);
  assert.deepEqual(calls[0], ['firebase', account.firebase_uid, 'new-secure-password', { expectedEmail: account.email }]);
  assert.equal(calls[1][0], 'audit');
  assert.equal(JSON.stringify(calls[1][1]).includes('new-secure-password'), false);
});

test('admin reset requires a valid admin and preserves 401 or 403 authorization results', async () => {
  for (const status of [401, 403]) {
    let firebaseCalled = false;
    const result = await resetClinicUserPasswordAsAdmin({}, userId, { password: 'new-secure-password' }, adminDependencies({
      requireAdmin: async () => ({ ok: false, status, data: { message: 'denied' } }),
      updateFirebaseUserPassword: async () => { firebaseCalled = true; return { ok: true }; },
    }));
    assert.equal(result.status, status);
    assert.equal(firebaseCalled, false);
  }
});

test('admin reset returns 404 for an absent app user and never calls Firebase', async () => {
  let firebaseCalled = false;
  const result = await resetClinicUserPasswordAsAdmin({}, userId, { password: 'new-secure-password' }, adminDependencies({
    client: makeClient({ accountRow: null }),
    updateFirebaseUserPassword: async () => { firebaseCalled = true; return { ok: true }; },
  }));
  assert.equal(result.status, 404);
  assert.equal(firebaseCalled, false);
});

test('admin reset rejects database read errors without claiming success', async () => {
  const result = await resetClinicUserPasswordAsAdmin({}, userId, { password: 'new-secure-password' }, adminDependencies({
    client: makeClient({ readError: { code: '08006', message: 'database unavailable' } }),
  }));
  assert.equal(result.status, 503);
  assert.equal(result.ok, false);
});

test('admin reset rejects a missing Firebase UID or email before calling Firebase', async () => {
  for (const patch of [{ firebase_uid: '' }, { email: '' }]) {
    let firebaseCalled = false;
    const result = await resetClinicUserPasswordAsAdmin({}, userId, { password: 'new-secure-password' }, adminDependencies({
      client: makeClient({ accountRow: { ...account, ...patch } }),
      updateFirebaseUserPassword: async () => { firebaseCalled = true; return { ok: true }; },
    }));
    assert.equal(result.status, 409);
    assert.equal(firebaseCalled, false);
  }
});

test('admin reset refuses a locked account and accounts outside clinic password roles', async () => {
  for (const patch of [{ status: 'disabled' }, { role: 'admin' }, { auth_provider: 'google' }]) {
    let firebaseCalled = false;
    const result = await resetClinicUserPasswordAsAdmin({}, userId, { password: 'new-secure-password' }, adminDependencies({
      client: makeClient({ accountRow: { ...account, ...patch } }),
      updateFirebaseUserPassword: async () => { firebaseCalled = true; return { ok: true }; },
    }));
    assert.equal(result.status, 409);
    assert.equal(firebaseCalled, false);
  }
});

test('admin reset returns 422 for invalid password type or length before calling Firebase', async () => {
  for (const password of ['short', 'x'.repeat(129), { value: 'new-secure-password' }, null]) {
    let firebaseCalled = false;
    const result = await resetClinicUserPasswordAsAdmin({}, userId, { password }, adminDependencies({
      updateFirebaseUserPassword: async () => { firebaseCalled = true; return { ok: true }; },
    }));
    assert.equal(result.status, 422);
    assert.equal(firebaseCalled, false);
  }
});

test('Firebase not-found or rejected password failures pass through without database writes', async () => {
  for (const failure of [
    { status: 404, code: 'auth/user-not-found', message: 'Firebase user not found' },
    { status: 400, code: 'auth/weak-password', message: 'Password rejected' },
  ]) {
    const client = makeClient();
    const result = await resetClinicUserPasswordAsAdmin({}, userId, { password: 'new-secure-password' }, adminDependencies({
      client,
      updateFirebaseUserPassword: async () => ({ ok: false, ...failure }),
    }));
    assert.equal(result.ok, false);
    assert.equal(result.status, failure.status);
    assert.equal(client.writes.length, 0);
  }
});

test('missing Firebase Admin configuration returns a clear 503 failure', async () => {
  const result = await resetClinicUserPasswordAsAdmin({}, userId, { password: 'new-secure-password' }, adminDependencies({
    updateFirebaseUserPassword: async () => ({ ok: false, status: 503, code: 'FIREBASE_ADMIN_CREDENTIALS_REQUIRED', message: 'Firebase Admin chưa được cấu hình.' }),
  }));
  assert.equal(result.status, 503);
  assert.equal(result.ok, false);
  assert.equal(result.data.code, 'FIREBASE_ADMIN_CREDENTIALS_REQUIRED');
});

test('Firebase session-revocation failure is a non-200 partial failure', async () => {
  const result = await resetClinicUserPasswordAsAdmin({}, userId, { password: 'new-secure-password' }, adminDependencies({
    updateFirebaseUserPassword: async () => ({
      ok: false, status: 503, code: 'FIREBASE_PASSWORD_UPDATED_SESSION_REVOCATION_FAILED',
      passwordUpdated: true, sessionsRevoked: false, message: 'Không thu hồi được phiên cũ.',
    }),
  }));
  assert.equal(result.ok, false);
  assert.equal(result.status, 503);
  assert.equal(result.data.passwordUpdated, true);
  assert.equal(result.data.sessionsRevoked, false);
});

test('backend exceptions do not return success or log password data', async () => {
  const result = await resetClinicUserPasswordAsAdmin({}, userId, { password: 'new-secure-password' }, adminDependencies({
    updateFirebaseUserPassword: async () => { throw new Error('backend exception'); },
  }));
  assert.equal(result.status, 502);
  assert.equal(result.ok, false);
  assert.equal(JSON.stringify(result).includes('new-secure-password'), false);
});
