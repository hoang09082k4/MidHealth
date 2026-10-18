import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {
  APP_ROLES,
  getAppUserByFirebaseUid,
  isRoleAllowed,
  requirePortal,
  requireRoles,
  rolesForPortal,
} from '../src/authorization_service.js';
import { upsertAppUser } from '../src/account_service.js';
import { verifyIdToken } from '../src/firebase_auth.js';
import { findOwnerProfile } from '../src/appointment_service.js';
import { config } from '../src/config.js';

test('admin portal only accepts admin role', () => {
  const roles = rolesForPortal('admin');
  assert.equal(isRoleAllowed(APP_ROLES.ADMIN, roles), true);
  assert.equal(isRoleAllowed('doctor', roles), false);
  assert.equal(isRoleAllowed(APP_ROLES.PATIENT, roles), false);
});

test('provider portal no longer accepts any role', () => {
  const roles = rolesForPortal('provider');
  assert.equal(isRoleAllowed('doctor', roles), false);
  assert.equal(isRoleAllowed('clinic', roles), false);
  assert.equal(isRoleAllowed('hospital', roles), false);
  assert.equal(isRoleAllowed(APP_ROLES.PATIENT, roles), false);
  assert.equal(isRoleAllowed(APP_ROLES.ADMIN, roles), false);
});

test('patient portal only accepts patient role', () => {
  const roles = rolesForPortal('patient');
  assert.equal(isRoleAllowed(APP_ROLES.PATIENT, roles), true);
  assert.equal(isRoleAllowed('doctor', roles), false);
  assert.equal(isRoleAllowed(APP_ROLES.ADMIN, roles), false);
});

test('shared sign-in accepts all five clinic roles and dedicated portals stay scoped', () => {
  const roles = rolesForPortal('account');
  assert.equal(isRoleAllowed(APP_ROLES.PATIENT, roles), true);
  assert.equal(isRoleAllowed(APP_ROLES.ADMIN, roles), true);
  assert.equal(isRoleAllowed(APP_ROLES.DOCTOR, roles), true);
  assert.equal(isRoleAllowed(APP_ROLES.STAFF, roles), true);
  assert.equal(isRoleAllowed(APP_ROLES.HEAD, roles), true);
  assert.deepEqual(rolesForPortal('staff'), [APP_ROLES.STAFF]);
  assert.equal(isRoleAllowed(APP_ROLES.HEAD, rolesForPortal('doctor')), true);
  assert.equal(isRoleAllowed(APP_ROLES.STAFF, rolesForPortal('admin')), false);
  assert.equal(isRoleAllowed('clinic', roles), false);
});

test('unknown portal denies every role', () => {
  const roles = rolesForPortal('unknown');
  assert.deepEqual(roles, []);
  assert.equal(isRoleAllowed(APP_ROLES.ADMIN, roles), false);
});

test('a new Firebase UID cannot take over an existing email identity', async () => {
  const client = {
    from() { return this; }, select() { return this; },
    eq(field) { this.field = field; return this; },
    async maybeSingle() {
      return { data: this.field === 'email' ? { id: 'existing', firebase_uid: 'original', role: 'patient', status: 'active' } : null };
    },
    update() { assert.fail('Identity must not be reassigned'); },
    insert() { assert.fail('Duplicate identity must not be created'); },
  };
  const result = await upsertAppUser({ localId: 'attacker', email: 'patient@example.com' }, {}, client);
  assert.equal(result.status, 409);
});

test('a patient cannot read another account profile through a matching email', async () => {
  let table = '';
  const client = {
    from(name) { table = name; return this; },
    select() { return this; },
    eq() { return this; },
    ilike() { return this; },
    async maybeSingle() {
      if (table === 'app_users') return { data: {
        id: 'current-account', email: 'shared@example.com', email_verified: true,
        role: 'patient', status: 'active',
      } };
      if (table === 'patient_profiles') {
        this.profileReads = (this.profileReads || 0) + 1;
        return { data: this.profileReads === 1 ? null : {
          id: 'old-profile', app_user_id: 'another-account',
        } };
      }
      return { data: null };
    },
  };
  const result = await findOwnerProfile({ localId: 'current-uid', email: 'shared@example.com' }, client);
  assert.equal(result, null);
});

test('former provider demo email does not grant privileged access', async () => {
  const firebaseUser = {
    localId: 'demo-provider-uid',
    email: 'hoang_2251220149@dau.edu.vn',
    displayName: 'Bac si Demo',
  };

  const account = await getAppUserByFirebaseUid(firebaseUser);
  assert.equal(account.ok, false);
  assert.equal(account.status, 503);

  const access = await requirePortal(firebaseUser, 'provider');
  assert.equal(access.ok, false);
});

test('an admin-looking email grants no rights when Supabase is unavailable', async () => {
  const firebaseUser = {
    localId: 'demo-admin-uid',
    email: 'admin@gmail.com',
    displayName: 'Admin Demo',
  };

  const account = await getAppUserByFirebaseUid(firebaseUser);
  assert.equal(account.ok, false);
  assert.equal(account.status, 503);

  const access = await requirePortal(firebaseUser, 'admin');
  assert.equal(access.ok, false);
});

test('admin access depends on the stored role and active status, never on email', async () => {
  let stored = { role: 'patient', status: 'active' };
  const client = {
    from() { return this; }, select() { return this; }, eq() { return this; },
    async maybeSingle() { return { data: stored }; },
  };
  const user = { localId: 'uid', email: 'admin@gmail.com' };
  assert.equal((await requireRoles(user, 'admin', { client })).status, 403);
  stored = { role: 'admin', status: 'disabled' };
  assert.equal((await requireRoles(user, 'admin', { client })).status, 403);
  stored = { role: 'admin', status: 'active' };
  assert.equal((await requireRoles(user, 'admin', { client })).ok, true);
});

test('Firebase rejects disabled accounts and failed token verification without fallback', async () => {
  assert.equal(await verifyIdToken('token', async () => ({ ok: false, data: { error: 'USER_DISABLED' } })), null);
  assert.equal(await verifyIdToken('token', async () => ({ ok: true, data: { users: [{ localId: 'uid', disabled: true }] } })), null);
  const user = { localId: 'uid', disabled: false };
  assert.deepEqual(await verifyIdToken('token', async () => ({ ok: true, data: { users: [user] } })), user);
});

test('configured Firebase Admin verifies session revocation and maps decoded identity claims', async () => {
  const previous = config.firebaseAdminCredentials;
  const { privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  config.firebaseAdminCredentials = {
    clientEmail: 'admin@example.test',
    privateKey: privateKey.export({ type: 'pkcs8', format: 'pem' }),
    projectId: config.firebaseProjectId,
  };
  try {
    const result = await verifyIdToken('firebase-id-token', undefined, async (token, checkRevoked) => {
      assert.equal(token, 'firebase-id-token');
      assert.equal(checkRevoked, true);
      return {
        uid: 'firebase-uid',
        email: 'doctor@example.test',
        name: 'Doctor Example',
        email_verified: true,
        firebase: { sign_in_provider: 'password' },
      };
    });
    assert.equal(result.localId, 'firebase-uid');
    assert.equal(result.email, 'doctor@example.test');
    assert.equal(result.displayName, 'Doctor Example');
    assert.equal(result.emailVerified, true);
    assert.equal(result.providerUserInfo[0].providerId, 'password.com');
  } finally {
    config.firebaseAdminCredentials = previous;
  }
});
