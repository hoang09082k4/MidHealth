import test from 'node:test';
import assert from 'node:assert/strict';
import { APP_ROLES, isRoleAllowed, rolesForPortal } from '../src/authorization_service.js';
import { canRelinkPatientIdentity } from '../src/account_service.js';

test('admin portal only accepts admin role', () => {
  const roles = rolesForPortal('admin');
  assert.equal(isRoleAllowed(APP_ROLES.ADMIN, roles), true);
  assert.equal(isRoleAllowed(APP_ROLES.DOCTOR, roles), false);
  assert.equal(isRoleAllowed(APP_ROLES.PATIENT, roles), false);
});

test('provider portal accepts doctor and clinic but not patient or admin', () => {
  const roles = rolesForPortal('provider');
  assert.equal(isRoleAllowed(APP_ROLES.DOCTOR, roles), true);
  assert.equal(isRoleAllowed(APP_ROLES.CLINIC, roles), true);
  assert.equal(isRoleAllowed(APP_ROLES.PATIENT, roles), false);
  assert.equal(isRoleAllowed(APP_ROLES.ADMIN, roles), false);
});

test('patient portal only accepts patient role', () => {
  const roles = rolesForPortal('patient');
  assert.equal(isRoleAllowed(APP_ROLES.PATIENT, roles), true);
  assert.equal(isRoleAllowed(APP_ROLES.DOCTOR, roles), false);
  assert.equal(isRoleAllowed(APP_ROLES.ADMIN, roles), false);
});

test('unknown portal denies every role', () => {
  const roles = rolesForPortal('unknown');
  assert.deepEqual(roles, []);
  assert.equal(isRoleAllowed(APP_ROLES.ADMIN, roles), false);
});

test('identity relink is limited to enabled patient accounts', () => {
  assert.equal(canRelinkPatientIdentity(
    { role: APP_ROLES.PATIENT, status: 'active' },
    { allowPatientIdentityRelink: true },
  ), true);
  assert.equal(canRelinkPatientIdentity(
    { role: APP_ROLES.PATIENT, status: 'disabled' },
    { allowPatientIdentityRelink: true },
  ), false);
  assert.equal(canRelinkPatientIdentity(
    { role: APP_ROLES.ADMIN, status: 'active' },
    { allowPatientIdentityRelink: true },
  ), false);
  assert.equal(canRelinkPatientIdentity(
    { role: APP_ROLES.PATIENT, status: 'active' },
    { allowPatientIdentityRelink: false },
  ), false);
});
