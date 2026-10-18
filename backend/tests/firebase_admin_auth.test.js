import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isFirebaseAdminConfigured,
  updateFirebaseUserPassword,
  verifyFirebaseIdToken,
} from '../src/firebase_admin_auth.js';

test('Firebase Admin SDK readiness reports missing credentials instead of inheriting Firebase client configuration', () => {
  assert.equal(isFirebaseAdminConfigured(), false);
});

test('password reset updates only the requested Firebase UID and revokes old refresh tokens', async () => {
  const calls = [];
  const auth = {
    async getUser(uid) {
      calls.push(['getUser', uid]);
      return { uid, email: 'doctor@example.test' };
    },
    async updateUser(uid, values) {
      calls.push(['updateUser', uid, values]);
      return { uid };
    },
    async revokeRefreshTokens(uid) {
      calls.push(['revokeRefreshTokens', uid]);
    },
  };

  const result = await updateFirebaseUserPassword('firebase-user-id', 'new-secure-password', { auth, expectedEmail: 'Doctor@Example.Test' });

  assert.deepEqual(result, { ok: true, status: 200, sessionsRevoked: true });
  assert.deepEqual(calls, [
    ['getUser', 'firebase-user-id'],
    ['updateUser', 'firebase-user-id', { password: 'new-secure-password' }],
    ['revokeRefreshTokens', 'firebase-user-id'],
  ]);
});

test('Firebase password reset rejects invalid UID and weak application passwords before SDK access', async () => {
  let called = false;
  const auth = { updateUser: async () => { called = true; }, revokeRefreshTokens: async () => {} };
  assert.equal((await updateFirebaseUserPassword('', 'new-secure-password', { auth })).status, 400);
  assert.equal((await updateFirebaseUserPassword('uid', 'short', { auth })).status, 400);
  assert.equal(called, false);
});

test('missing Firebase Admin credential fails without pretending a reset occurred', async () => {
  const result = await updateFirebaseUserPassword('firebase-user-id', 'new-secure-password');
  assert.equal(result.ok, false);
  assert.equal(result.status, 503);
  assert.equal(result.code, 'FIREBASE_ADMIN_CREDENTIALS_REQUIRED');
});

test('Firebase user not found maps to 404 and does not revoke sessions', async () => {
  const auth = {
    async updateUser() { throw Object.assign(new Error('missing user'), { code: 'auth/user-not-found' }); },
    async revokeRefreshTokens() { assert.fail('must not revoke a missing account'); },
  };
  const result = await updateFirebaseUserPassword('missing-uid', 'new-secure-password', { auth });
  assert.equal(result.ok, false);
  assert.equal(result.status, 404);
});

test('Firebase weak password and permission errors are mapped safely', async () => {
  const weakAuth = { getUser: async () => ({ uid: 'uid', email: 'doctor@example.test' }), updateUser: async () => { throw Object.assign(new Error(), { code: 'auth/weak-password' }); } };
  const deniedAuth = { getUser: async () => ({ uid: 'uid', email: 'doctor@example.test' }), updateUser: async () => { throw Object.assign(new Error(), { code: 'auth/insufficient-permission' }); } };
  assert.equal((await updateFirebaseUserPassword('uid', 'new-secure-password', { auth: weakAuth })).status, 400);
  assert.equal((await updateFirebaseUserPassword('uid', 'new-secure-password', { auth: deniedAuth })).status, 503);
});

test('password update reports partial success if refresh token revocation fails', async () => {
  const auth = {
    async getUser(uid) { return { uid, email: 'doctor@example.test' }; },
    async updateUser(uid) { return { uid }; },
    async revokeRefreshTokens() { throw Object.assign(new Error(), { code: 'auth/insufficient-permission' }); },
  };
  const result = await updateFirebaseUserPassword('uid', 'new-secure-password', { auth });
  assert.equal(result.ok, false);
  assert.equal(result.status, 503);
  assert.equal(result.passwordUpdated, true);
  assert.equal(result.sessionsRevoked, false);
});

test('Firebase UID with missing or mismatched email never reaches password update', async () => {
  for (const firebaseUser of [
    { uid: 'uid' },
    { uid: 'uid', email: 'someone-else@example.test' },
    { uid: 'uid', email: 'doctor@example.test', disabled: true },
  ]) {
    let updateCalled = false;
    const result = await updateFirebaseUserPassword('uid', 'new-secure-password', {
      auth: {
        getUser: async () => firebaseUser,
        updateUser: async uid => { updateCalled = true; return { uid }; },
        revokeRefreshTokens: async () => {},
      },
      expectedEmail: 'doctor@example.test',
    });
    assert.equal(result.ok, false);
    assert.equal(result.status, 409);
    assert.equal(updateCalled, false);
  }
});

test('Firebase UID that does not exist is rejected before attempting a password update', async () => {
  let updateCalled = false;
  const result = await updateFirebaseUserPassword('missing-uid', 'new-secure-password', {
    auth: {
      getUser: async () => { throw Object.assign(new Error('missing'), { code: 'auth/user-not-found' }); },
      updateUser: async uid => { updateCalled = true; return { uid }; },
      revokeRefreshTokens: async () => {},
    },
    expectedEmail: 'doctor@example.test',
  });
  assert.equal(result.ok, false);
  assert.equal(result.status, 404);
  assert.equal(updateCalled, false);
});

test('revoked or invalid Firebase ID tokens fail closed in Admin SDK verification', async () => {
  const auth = {
    async verifyIdToken(token, checkRevoked) {
      assert.equal(token, 'old-token');
      assert.equal(checkRevoked, true);
      throw Object.assign(new Error('revoked'), { code: 'auth/id-token-revoked' });
    },
  };
  assert.equal(await verifyFirebaseIdToken('old-token', true, { auth }), null);
});
