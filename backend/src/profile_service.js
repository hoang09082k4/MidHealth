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

  const { data, error } = await supabase
    .from('patient_profiles')
    .upsert({
      firebase_uid: firebaseUser.localId,
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
      email_verified: true,
    }, { onConflict: 'firebase_uid' })
    .select()
    .single();

  if (error) {
    return { ok: false, status: 500, data: { message: error.message } };
  }

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
