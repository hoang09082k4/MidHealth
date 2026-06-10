import { hasSupabaseConfig, supabase } from './supabase.js';

export const APP_ROLES = Object.freeze({
  ADMIN: 'admin',
  PATIENT: 'patient',
  DOCTOR: 'doctor',
  CLINIC: 'clinic',
  STAFF: 'staff',
});

export const PORTAL_ROLES = Object.freeze({
  admin: [APP_ROLES.ADMIN],
  provider: [APP_ROLES.DOCTOR, APP_ROLES.CLINIC],
  patient: [APP_ROLES.PATIENT],
});

function clean(value) {
  return typeof value === 'string' ? value.trim() : value;
}

export function firebaseUid(firebaseUser = {}) {
  return clean(firebaseUser.localId || firebaseUser.uid);
}

export async function getAppUserByFirebaseUid(firebaseUser) {
  if (!hasSupabaseConfig) {
    return { ok: false, status: 503, data: { message: 'Backend chưa cấu hình Supabase.' } };
  }

  const uid = firebaseUid(firebaseUser);
  if (!uid) {
    return { ok: false, status: 401, data: { message: 'Phiên đăng nhập không hợp lệ.' } };
  }

  const { data, error } = await supabase
    .from('app_users')
    .select('*')
    .eq('firebase_uid', uid)
    .maybeSingle();

  if (error) return { ok: false, status: 500, data: { message: 'Không thể xác minh quyền truy cập.' } };
  if (!data) return { ok: false, status: 404, data: { message: 'Tài khoản chưa được cấp quyền cho hệ thống.' } };
  return { ok: true, status: 200, data };
}

export async function requireRoles(firebaseUser, allowedRoles, options = {}) {
  const account = await getAppUserByFirebaseUid(firebaseUser);
  if (!account.ok) return account;

  const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
  const allowedStatuses = options.allowedStatuses || ['active'];
  if (!isRoleAllowed(account.data.role, roles) || !allowedStatuses.includes(account.data.status)) {
    console.warn(JSON.stringify({
      type: 'authorization_denied',
      firebaseUid: firebaseUid(firebaseUser),
      actualRole: account.data.role,
      requiredRoles: roles,
      status: account.data.status,
      at: new Date().toISOString(),
    }));
    return {
      ok: false,
      status: 403,
      data: { message: options.message || 'Tài khoản không có quyền truy cập chức năng này.' },
    };
  }

  return account;
}

export function rolesForPortal(portal = '') {
  return PORTAL_ROLES[clean(portal).toLowerCase()] || [];
}

export function isRoleAllowed(role, allowedRoles) {
  const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
  return roles.includes(role);
}

export async function requirePortal(firebaseUser, portal) {
  const roles = rolesForPortal(portal);
  if (!roles.length) {
    return { ok: false, status: 400, data: { message: 'Cổng đăng nhập không hợp lệ.' } };
  }
  return requireRoles(firebaseUser, roles, {
    message: 'Tài khoản không thuộc cổng đăng nhập này.',
  });
}
