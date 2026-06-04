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
    role: options.role || 'patient',
    status: options.status || 'active',
    auth_provider: options.authProvider || getProvider(firebaseUser),
    email_verified: Boolean(firebaseUser.emailVerified || options.emailVerified),
    ...(options.markLogin ? { last_login_at: new Date().toISOString() } : {}),
  };

  const { data, error } = await supabase
    .from('app_users')
    .select('id')
    .or(`firebase_uid.eq.${firebaseUid},email.eq.${email}`)
    .limit(1)
    .maybeSingle();

  if (error) {
    return { ok: false, status: 500, data: { message: error.message } };
  }

  const saveResult = data?.id
    ? await supabase
      .from('app_users')
      .update(row)
      .eq('id', data.id)
      .select()
      .single()
    : await supabase
      .from('app_users')
      .insert(row)
      .select()
      .single();

  if (saveResult.error) {
    return { ok: false, status: 500, data: { message: saveResult.error.message } };
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
