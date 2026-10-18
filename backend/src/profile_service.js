import { claimWalkInPatientProfile, linkPatientProfileToAppUser, upsertAppUser } from './account_service.js';
import { hasSupabaseConfig, supabase } from './supabase.js';
import { validateBookingPatient } from './booking_policy.js';

function clean(value) {
  return typeof value === 'string' ? value.trim() : value;
}

function normalizeEmail(email = '') {
  return typeof email === 'string' ? email.trim().toLowerCase() : '';
}

function mapGender(gender) {
  if (gender === 'Nam' || gender === 'male') return 'male';
  if (gender === 'Nữ' || gender === 'female') return 'female';
  return 'other';
}

async function findExistingPatientProfile({ firebaseUid, appUserId }) {
  const lookups = [
    ['firebase_uid', firebaseUid],
    ['app_user_id', appUserId],
  ].filter(([, value]) => value);

  for (const [column, value] of lookups) {
    const { data, error } = await supabase
      .from('patient_profiles')
      .select('id')
      .eq(column, value)
      .maybeSingle();

    if (error) return { error };
    if (data?.id) return { data };
  }

  return { data: null };
}

export async function savePatientProfile(firebaseUser, payload = {}) {
  if (!hasSupabaseConfig) {
    return { ok: false, status: 503, data: { message: 'Chưa kết nối cơ sở dữ liệu để lưu hồ sơ.' } };
  }

  const profile = payload.profile || {};
  const fullName = clean(profile.fullName || payload.fullName || firebaseUser.displayName);
  const email = normalizeEmail(firebaseUser.email);
  const phone = clean(profile.phone);
  const dateOfBirth = clean(profile.dateOfBirth);

  if (!firebaseUser.localId || !email || !fullName || !phone || !dateOfBirth) {
    return {
      ok: false,
      status: 400,
      data: { message: 'Thiếu thông tin hồ sơ bắt buộc để lưu Supabase.' },
    };
  }
  const validationError = validateBookingPatient({ fullName, phone, dateOfBirth, email });
  if (validationError) return { ok: false, status: 400, data: { message: validationError } };

  const accountResult = await upsertAppUser(firebaseUser, {
    authProvider: payload.authProvider || 'password',
    fullName,
    email,
    emailVerified: Boolean(firebaseUser.emailVerified || firebaseUser.emailVerifiedByOtp),
    markLogin: true,
  });
  if (!accountResult.ok) return accountResult;
  const emailVerified = Boolean(firebaseUser.emailVerified || firebaseUser.emailVerifiedByOtp || accountResult.data?.email_verified);

  const claimedWalkIn = await claimWalkInPatientProfile(firebaseUser, accountResult.data?.id, {
    fullName, phone, dateOfBirth, gender: mapGender(profile.gender), emailVerified,
  });
  if (!claimedWalkIn.ok) return claimedWalkIn;

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
    email_verified: emailVerified,
    last_login_at: new Date().toISOString(),
  };

  let { data: existingProfile, error: lookupError } = claimedWalkIn.data?.id
    ? { data: claimedWalkIn.data, error: null }
    : await findExistingPatientProfile({
    firebaseUid: firebaseUser.localId,
    appUserId: accountResult.data?.id,
    email,
  });

  if (lookupError) {
    return { ok: false, status: 500, data: { message: lookupError.message } };
  }

  if (!existingProfile) {
    const { data: emailOwner, error: emailLookupError } = await supabase
      .from('patient_profiles')
      .select('id, firebase_uid')
      .ilike('email', email)
      .maybeSingle();
    if (emailLookupError) return { ok: false, status: 500, data: { message: emailLookupError.message } };
    if (emailOwner?.firebase_uid === firebaseUser.localId) {
      existingProfile = emailOwner;
    } else if (emailOwner) return {
      ok: false,
      status: 409,
      data: { message: 'Email này đã có hồ sơ bệnh nhân. Vui lòng đăng nhập tài khoản cũ hoặc liên hệ quản trị viên.' },
    };
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
    const emailConflict = error.code === '23505' && error.message?.includes('patient_profiles_email_lower_unique_idx');
    return { ok: false, status: emailConflict ? 409 : 500, data: {
      message: emailConflict
        ? 'Email này đã có hồ sơ bệnh nhân. Vui lòng đăng nhập tài khoản cũ hoặc liên hệ quản trị viên.'
        : error.message,
    } };
  }

  await linkPatientProfileToAppUser(firebaseUser.localId, accountResult.data?.id);

  return { ok: true, status: 200, data };
}

export async function hasCompletePatientProfile(firebaseUser = {}) {
  if (!hasSupabaseConfig) return false;
  if (!firebaseUser.localId) return false;

  const { data, error } = await supabase
    .from('patient_profiles')
    .select('id, full_name, phone, date_of_birth, status')
    .eq('firebase_uid', firebaseUser.localId)
    .maybeSingle();

  if (error || !data) return false;
  return Boolean(
    data.status === 'active'
    && clean(data.full_name)
    && clean(data.phone)
    && clean(data.date_of_birth),
  );
}

export async function ensureProfileTableReady() {
  if (!hasSupabaseConfig) {
    return { ok: false, status: 503, data: { message: 'Chưa kết nối cơ sở dữ liệu để lưu hồ sơ.' } };
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
