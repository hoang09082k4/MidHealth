import { hasSupabaseConfig, supabase } from './supabase.js';

function clean(value) {
  return typeof value === 'string' ? value.trim() : value;
}

function normalizeEmail(email = '') {
  return typeof email === 'string' ? email.trim().toLowerCase() : '';
}

function getProvider(firebaseUser = {}, fallback = 'password') {
  const providerId = firebaseUser.providerUserInfo?.[0]?.providerId || '';
  if (providerId.includes('google')) return 'google';
  if (providerId.includes('password')) return 'password';
  return fallback;
}

export async function upsertAppUser(firebaseUser = {}, options = {}, client = supabase) {
  if (!client) {
    return { ok: false, status: 503, data: { message: 'Chưa kết nối cơ sở dữ liệu để lưu tài khoản.' } };
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

  const { data, error } = await client
    .from('app_users')
    .select('id, firebase_uid, email, role, status, email_verified')
    .eq('firebase_uid', firebaseUid)
    .maybeSingle();

  if (error) {
    return { ok: false, status: 500, data: { message: error.message } };
  }

  const existingAccount = data;
  if (existingAccount && existingAccount.status !== 'active') {
    return { ok: false, status: 403, data: { message: 'Tài khoản chưa hoạt động hoặc đã bị khóa.' } };
  }

  if (!existingAccount?.id) {
    const { data: emailOwner, error: emailLookupError } = await client
      .from('app_users')
      .select('id, firebase_uid, email, role, status, email_verified')
      .eq('email', email)
      .maybeSingle();
    if (emailLookupError) {
      return { ok: false, status: 500, data: { message: emailLookupError.message } };
    }
    if (emailOwner?.id) {
      return {
        ok: false,
        status: 409,
        data: { message: 'Email đã được liên kết với một danh tính khác. Vui lòng liên hệ quản trị viên.' },
      };
    }
  }

  const allowRoleChange = Boolean(options.allowRoleChange);
  const saveResult = existingAccount?.id
    ? await client
      .from('app_users')
      .update({
        ...row,
        email_verified: Boolean(row.email_verified || (existingAccount.email_verified && normalizeEmail(existingAccount.email) === email)),
        ...(allowRoleChange && options.role ? { role: options.role } : {}),
        ...(options.status ? { status: options.status } : {}),
      })
      .eq('id', existingAccount.id)
      .select()
      .single()
    : await client
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

function normalizePatientName(value = '') {
  return String(value || '').normalize('NFC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('vi');
}

function normalizePatientPhone(value = '') {
  const digits = String(value || '').replace(/\D/g, '');
  return digits.startsWith('84') && digits.length === 11 ? `0${digits.slice(2)}` : digits;
}

/**
 * Reconnect a counter-created profile when the patient later creates an account.
 * The email must be verified by Firebase and name, phone, and date of birth must
 * also match the counter record. Never claim a profile based on email alone.
 */
export async function claimWalkInPatientProfile(firebaseUser = {}, appUserId, profile = {}, client = supabase) {
  const email = normalizeEmail(firebaseUser.email);
  const fullName = clean(profile.fullName || profile.name);
  const phone = normalizePatientPhone(profile.phone);
  const dateOfBirth = clean(profile.dateOfBirth || profile.birthDate);
  if (!(firebaseUser.emailVerified || profile.emailVerified) || !email || !fullName || !phone || !dateOfBirth || !appUserId) {
    return { ok: true, data: null, skipped: true };
  }

  const { data: candidates, error } = await client
    .from('patient_profiles')
    .select('id,firebase_uid,app_user_id,patient_medical_profiles!inner(full_name,phone,date_of_birth,email)')
    .like('firebase_uid', 'walkin-%')
    .is('app_user_id', null)
    .ilike('patient_medical_profiles.email', email)
    .limit(100);
  if (error) return { ok: false, status: 503, data: { message: error.message } };

  const matches = (candidates || []).filter(owner => (owner.patient_medical_profiles || []).some(patient =>
    normalizeEmail(patient.email) === email
    && normalizePatientName(patient.full_name) === normalizePatientName(fullName)
    && normalizePatientPhone(patient.phone) === phone
    && String(patient.date_of_birth || '').slice(0, 10) === dateOfBirth,
  ));
  if (matches.length > 1) {
    return { ok: false, status: 409, data: { message: 'Có nhiều hồ sơ tại quầy trùng thông tin. Vui lòng liên hệ nhân viên để xác minh và liên kết thủ công.' } };
  }
  if (!matches.length) return { ok: true, data: null, skipped: true };

  const owner = matches[0];
  const { data, error: updateError } = await client.from('patient_profiles').update({
    firebase_uid: clean(firebaseUser.localId || firebaseUser.uid),
    app_user_id: appUserId,
    email,
    full_name: fullName.trim(),
    phone: clean(profile.phone),
    date_of_birth: dateOfBirth,
    gender: profile.gender === 'male' || profile.gender === 'female' ? profile.gender : 'other',
    email_verified: true,
    last_login_at: new Date().toISOString(),
  }).eq('id', owner.id).is('app_user_id', null).select().maybeSingle();
  if (updateError) return { ok: false, status: updateError.code === '23505' ? 409 : 503, data: {
    message: updateError.code === '23505'
      ? 'Tài khoản hoặc email đã được liên kết với hồ sơ khác. Vui lòng liên hệ phòng khám để kiểm tra.'
      : updateError.message,
  } };
  if (!data) return { ok: false, status: 409, data: { message: 'Hồ sơ vừa được liên kết ở một phiên khác. Hãy tải lại và đăng nhập lại.' } };
  return { ok: true, status: 200, data };
}

