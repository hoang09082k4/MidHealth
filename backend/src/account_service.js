import { hasSupabaseConfig, supabase } from './supabase.js';

function clean(value) {
  return typeof value === 'string' ? value.trim() : value;
}

function normalizeEmail(email = '') {
  return clean(email).toLowerCase();
}

function getProvider(firebaseUser = {}, fallback = 'password') {
  const providerId = firebaseUser.providerUserInfo?.[0]?.providerId || '';
  if (providerId.includes('google')) return 'google';
  if (providerId.includes('password')) return 'password';
  return fallback;
}

export function canRelinkPatientIdentity(emailOwner = {}, options = {}) {
  return Boolean(
    options.allowPatientIdentityRelink
    && emailOwner.role === 'patient'
    && emailOwner.status !== 'disabled',
  );
}

async function relinkPatientProfileIdentity({ email, firebaseUid, appUserId }) {
  const { data: currentProfile, error: currentProfileError } = await supabase
    .from('patient_profiles')
    .select('id')
    .eq('firebase_uid', firebaseUid)
    .maybeSingle();

  if (currentProfileError) return currentProfileError;

  const query = supabase
    .from('patient_profiles')
    .update({
      firebase_uid: firebaseUid,
      app_user_id: appUserId,
      role: 'patient',
      status: 'active',
      last_login_at: new Date().toISOString(),
    });

  const { error } = currentProfile?.id
    ? await query.eq('id', currentProfile.id)
    : await query.eq('email', email).eq('role', 'patient');

  return error || null;
}

export async function upsertAppUser(firebaseUser = {}, options = {}) {
  if (!hasSupabaseConfig) {
    return { ok: true, skipped: true, data: null };
  }

  const firebaseUid = clean(firebaseUser.localId || firebaseUser.uid);
  const email = normalizeEmail(firebaseUser.email || options.email);

  if (!firebaseUid || !email) {
    return {
      ok: false,
      status: 400,
      data: { message: 'Thiếu Firebase UID hoặc email để lưu tài khoản.' },
    };
  }

  const row = {
    firebase_uid: firebaseUid,
    email,
    full_name: clean(firebaseUser.displayName || options.fullName) || null,
    avatar_url: clean(firebaseUser.photoUrl || firebaseUser.photoURL || options.avatarUrl) || null,
    auth_provider: options.authProvider || getProvider(firebaseUser),
    email_verified: Boolean(firebaseUser.emailVerified || options.emailVerified),
    ...(options.markLogin ? { last_login_at: new Date().toISOString() } : {}),
  };

  const { data, error } = await supabase
    .from('app_users')
    .select('id, firebase_uid, email, role, status')
    .eq('firebase_uid', firebaseUid)
    .maybeSingle();

  if (error) {
    return { ok: false, status: 500, data: { message: error.message } };
  }

  let existingAccount = data;
  let identityRelinked = false;

  if (!existingAccount?.id) {
    const { data: emailOwner, error: emailLookupError } = await supabase
      .from('app_users')
      .select('id, firebase_uid, email, role, status')
      .eq('email', email)
      .maybeSingle();
    if (emailLookupError) {
      return { ok: false, status: 500, data: { message: emailLookupError.message } };
    }
    if (emailOwner?.firebase_uid && emailOwner.firebase_uid !== firebaseUid) {
      if (!canRelinkPatientIdentity(emailOwner, options)) {
        return {
          ok: false,
          status: 409,
          data: { message: 'Email đã được liên kết với một danh tính khác. Vui lòng liên hệ quản trị viên.' },
        };
      }
      existingAccount = emailOwner;
      identityRelinked = true;
    }
  }

  const allowRoleChange = Boolean(options.allowRoleChange);
  const saveResult = existingAccount?.id
    ? await supabase
      .from('app_users')
      .update({
        ...row,
        ...(allowRoleChange && options.role ? { role: options.role } : {}),
        ...(options.status ? { status: options.status } : {}),
      })
      .eq('id', existingAccount.id)
      .select()
      .single()
    : await supabase
      .from('app_users')
      .insert({
        ...row,
        role: options.role || 'patient',
        status: options.status || 'active',
      })
      .select()
      .single();

  if (saveResult.error) {
    return { ok: false, status: 500, data: { message: saveResult.error.message } };
  }

  if (identityRelinked) {
    const profileRelinkError = await relinkPatientProfileIdentity({
      email,
      firebaseUid,
      appUserId: saveResult.data.id,
    });
    if (profileRelinkError) {
      return { ok: false, status: 500, data: { message: profileRelinkError.message } };
    }
  }

  return { ok: true, status: 200, data: saveResult.data };
}

export async function linkPatientProfileToAppUser(firebaseUid, appUserId) {
  if (!hasSupabaseConfig || !firebaseUid || !appUserId) {
    return { ok: true, skipped: true, data: null };
  }

  const { data, error } = await supabase
    .from('patient_profiles')
    .update({
      app_user_id: appUserId,
      role: 'patient',
      status: 'active',
      last_login_at: new Date().toISOString(),
    })
    .eq('firebase_uid', firebaseUid)
    .select()
    .maybeSingle();

  if (error) {
    return { ok: false, status: 500, data: { message: error.message } };
  }

  return { ok: true, status: 200, data };
}
