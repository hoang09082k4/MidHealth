import { hasSupabaseConfig, supabase } from './supabase.js';

export const APP_ROLES = Object.freeze({
  ADMIN: 'admin',
  PATIENT: 'patient',
  DOCTOR: 'doctor',
  CLINIC: 'clinic',
  HOSPITAL: 'hospital',
  STAFF: 'staff',
});

export const PORTAL_ROLES = Object.freeze({
  admin: [APP_ROLES.ADMIN],
  provider: [APP_ROLES.DOCTOR, APP_ROLES.CLINIC, APP_ROLES.HOSPITAL],
  patient: [APP_ROLES.PATIENT],
});

function clean(value) {
  return typeof value === 'string' ? value.trim() : value;
}

function normalizeEmail(value = '') {
  return String(clean(value) || '').toLowerCase();
}

const demoRoleByEmail = new Map([
  ['admin@gmail.com', APP_ROLES.ADMIN],
  ['hoang_2251220149@dau.edu.vn', APP_ROLES.DOCTOR],
]);

export function firebaseUid(firebaseUser = {}) {
  return clean(firebaseUser.localId || firebaseUser.uid);
}

function authProvider(firebaseUser = {}) {
  return firebaseUser?.providerUserInfo?.[0]?.providerId?.includes('google') ? 'google' : 'password';
}

async function ensureDemoPortalAccount(firebaseUser = {}) {
  if (!hasSupabaseConfig) return null;

  const email = normalizeEmail(firebaseUser?.email);
  const role = demoRoleByEmail.get(email);
  const uid = firebaseUid(firebaseUser);
  if (!role || !uid || !email) return null;

  const row = {
    firebase_uid: uid,
    email,
    full_name: clean(firebaseUser?.displayName) || email,
    avatar_url: clean(firebaseUser?.photoUrl || firebaseUser?.photoURL) || null,
    role,
    status: 'active',
    auth_provider: authProvider(firebaseUser),
    email_verified: Boolean(firebaseUser?.emailVerified),
    last_login_at: new Date().toISOString(),
  };

  const { data: existingByUid, error: uidError } = await supabase
    .from('app_users')
    .select('id')
    .eq('firebase_uid', uid)
    .maybeSingle();
  if (uidError) throw uidError;

  if (existingByUid?.id) {
    const { data, error } = await supabase
      .from('app_users')
      .update(row)
      .eq('id', existingByUid.id)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  const { data: existingByEmail, error: emailError } = await supabase
    .from('app_users')
    .select('id')
    .eq('email', email)
    .maybeSingle();
  if (emailError) throw emailError;

  const result = existingByEmail?.id
    ? await supabase.from('app_users').update(row).eq('id', existingByEmail.id).select().single()
    : await supabase.from('app_users').insert(row).select().single();

  if (result.error) throw result.error;
  return result.data;
}

export async function getAppUserByFirebaseUid(firebaseUser) {
  if (!hasSupabaseConfig) {
    const email = normalizeEmail(firebaseUser?.email);
    const role = demoRoleByEmail.get(email) || APP_ROLES.PATIENT;
    return {
      ok: true,
      status: 200,
      demo: true,
      data: {
        id: `demo-${role}`,
        firebase_uid: firebaseUid(firebaseUser) || `demo-${role}`,
        email,
        full_name: clean(firebaseUser?.displayName) || email || 'MidHealth Demo',
        role,
        status: 'active',
        auth_provider: authProvider(firebaseUser),
      },
    };
  }

  const uid = firebaseUid(firebaseUser);
  if (!uid) {
    return { ok: false, status: 401, data: { message: 'Phiên đăng nhập không hợp lệ.' } };
  }

  try {
    const demoAccount = await ensureDemoPortalAccount(firebaseUser);
    if (demoAccount) return { ok: true, status: 200, data: demoAccount };
  } catch (error) {
    return { ok: false, status: 500, data: { message: error.message } };
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
