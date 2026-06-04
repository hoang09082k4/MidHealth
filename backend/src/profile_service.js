import { linkPatientProfileToAppUser, upsertAppUser } from './account_service.js';
import { hasSupabaseConfig, supabase } from './supabase.js';

function clean(value) {
  return typeof value === 'string' ? value.trim() : value;
}

function normalizeEmail(email = '') {
  return clean(email).toLowerCase();
}

function mapGender(gender) {
  if (gender === 'Nam' || gender === 'male') return 'male';
  if (gender === 'Nữ' || gender === 'female') return 'female';
  return 'other';
}

export async function savePatientProfile(firebaseUser, payload = {}) {
  if (!hasSupabaseConfig) {
    return { ok: true, skipped: true, data: null };
  }

  const profile = payload.profile || {};
  const fullName = clean(profile.fullName || payload.fullName || firebaseUser.displayName);
  const email = normalizeEmail(profile.email || payload.email || firebaseUser.email);
  const phone = clean(profile.phone);
  const dateOfBirth = clean(profile.dateOfBirth);

  if (!firebaseUser.localId || !email || !fullName || !phone || !dateOfBirth) {
    return {
      ok: false,
      status: 400,
      data: { message: 'Thiếu thông tin hồ sơ bắt buộc để lưu Supabase.' },
    };
  }

  const accountResult = await upsertAppUser(firebaseUser, {
    authProvider: payload.authProvider || 'password',
    fullName,
    email,
    emailVerified: true,
    markLogin: true,
  });
  if (!accountResult.ok) return accountResult;

  const profileRow = {
    firebase_uid: firebaseUser.localId,
    app_user_id: accountResult.data?.id || null,
    email,
    full_name: fullName,
    phone,
    date_of_birth: dateOfBirth,
    gender: mapGender(profile.gender),
    citizen_id: clean(profile.citizenId) || null,
    health_insurance_number: clean(profile.healthInsuranceNumber) || null,
    province: clean(profile.province) || null,
    district: clean(profile.district) || null,
    ward: clean(profile.ward) || null,
    address: clean(profile.address) || null,
    ethnicity: clean(profile.ethnicity) || 'Kinh',
    occupation: clean(profile.occupation) || null,
    referral_code: clean(profile.referralCode) || null,
    role: 'patient',
    status: 'active',
    email_verified: true,
    last_login_at: new Date().toISOString(),
  };

  const { data: existingProfile, error: lookupError } = await supabase
    .from('patient_profiles')
    .select('id')
    .or(`firebase_uid.eq.${firebaseUser.localId},email.eq.${email}`)
    .limit(1)
    .maybeSingle();

  if (lookupError) {
    return { ok: false, status: 500, data: { message: lookupError.message } };
  }

  const { data, error } = existingProfile?.id
    ? await supabase
      .from('patient_profiles')
      .update(profileRow)
      .eq('id', existingProfile.id)
      .select()
      .single()
    : await supabase
      .from('patient_profiles')
      .insert(profileRow)
      .select()
      .single();

  if (error) {
    return { ok: false, status: 500, data: { message: error.message } };
  }

  await linkPatientProfileToAppUser(firebaseUser.localId, accountResult.data?.id);

  return { ok: true, status: 200, data };
}

export async function ensureProfileTableReady() {
  if (!hasSupabaseConfig) {
    return { ok: true, skipped: true };
  }

  const { error } = await supabase
    .from('patient_profiles')
    .select('id')
    .limit(1);

  if (!error) return { ok: true };

  return {
    ok: false,
    status: 500,
    data: {
      message: "Chưa tìm thấy bảng Supabase 'patient_profiles'. Hãy chạy file supabase/schema.sql trong Supabase SQL Editor rồi thử lại.",
      detail: error.message,
    },
  };
}
