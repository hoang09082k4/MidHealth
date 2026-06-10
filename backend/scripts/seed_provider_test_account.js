import { upsertAppUser } from '../src/account_service.js';
import { loginWithEmail, registerWithEmail } from '../src/firebase_auth.js';
import { hasSupabaseConfig, supabase } from '../src/supabase.js';

const TEST_EMAIL = 'test@gmail.com';
const TEST_PASSWORD = '123456';
const TEST_NAME = 'Bác sĩ Test MidHealth';
const TEST_PHONE = '0900000000';
const TEST_SPECIALTY = 'Khám tổng quát';

function slugify(value = '') {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\u0111/g, 'd')
    .replace(/\u0110/g, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'midhealth-test';
}

function todayDateValue(offsetDays = 1) {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

async function getOrCreateFirebaseUser() {
  const registerResult = await registerWithEmail({
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
    fullName: TEST_NAME,
  });

  if (registerResult.ok) return registerResult.data;

  if (!String(registerResult.data?.code || '').includes('EMAIL_EXISTS')) {
    throw new Error(registerResult.data?.message || 'Không thể tạo tài khoản Firebase test.');
  }

  const loginResult = await loginWithEmail({
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
  });
  if (!loginResult.ok) {
    throw new Error(`${registerResult.data?.message || 'Email đã tồn tại.'} Không thể đăng nhập bằng mật khẩu 123456.`);
  }

  return {
    ...loginResult.data,
    displayName: loginResult.data.displayName || TEST_NAME,
    email: TEST_EMAIL,
    emailVerified: true,
  };
}

async function getOrCreateSpecialty() {
  const { data: existing, error: lookupError } = await supabase
    .from('clinic_specialties')
    .select('id, name')
    .eq('name', TEST_SPECIALTY)
    .maybeSingle();
  if (lookupError) throw lookupError;
  if (existing) return existing;

  const { data, error } = await supabase
    .from('clinic_specialties')
    .insert({
      slug: slugify(TEST_SPECIALTY),
      name: TEST_SPECIALTY,
      description: 'Chuyên khoa dùng cho tài khoản test bác sĩ MidHealth.',
      is_active: true,
    })
    .select('id, name')
    .single();
  if (error) throw error;
  return data;
}

async function upsertTestDoctor(firebaseUid, specialtyId) {
  const slug = `bac-si-test-${String(firebaseUid).slice(0, 8)}`;
  const { data, error } = await supabase
    .from('doctors')
    .upsert({
      slug,
      full_name: TEST_NAME,
      initials: 'BT',
      title: 'BS',
      specialty_id: specialtyId,
      workplace_text: 'MidHealth Test Workspace',
      years_experience: 5,
      consultation_fee: 150000,
      intro: 'Tài khoản test dùng để kiểm tra workspace bác sĩ MidHealth.',
      is_active: true,
    }, { onConflict: 'slug' })
    .select('id')
    .single();
  if (error) throw error;
  return data;
}

async function upsertTestWorkspace(firebaseUser, appUserId, doctorId) {
  const row = {
    firebase_uid: firebaseUser.localId,
    app_user_id: appUserId,
    email: TEST_EMAIL,
    owner_name: TEST_NAME,
    owner_phone: TEST_PHONE,
    mode: 'doctor',
    provider_role: 'doctor',
    linked_doctor_id: doctorId,
    linked_facility_id: null,
    status: 'approved',
    doctor_title: 'BS',
    specialty: TEST_SPECIALTY,
    clinic_name: null,
    clinic_address: null,
    tax_code: null,
    image_url: null,
    review_note: 'Tài khoản test được tạo tự động cho môi trường phát triển.',
    submitted_at: new Date().toISOString(),
    reviewed_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('provider_workspaces')
    .upsert(row, { onConflict: 'firebase_uid' })
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function ensureSlots(doctorId, specialtyId) {
  const slotDate = todayDateValue(1);
  const times = ['07:30', '08:00', '08:30', '09:00', '13:30', '14:00'];

  for (const start of times) {
    const [hour, minute] = start.split(':').map(Number);
    const end = new Date(2000, 0, 1, hour, minute + 30, 0);
    const endTime = `${String(end.getHours()).padStart(2, '0')}:${String(end.getMinutes()).padStart(2, '0')}:00`;
    const startTime = `${start}:00`;

    const { data: existing, error: lookupError } = await supabase
      .from('appointment_slots')
      .select('id')
      .eq('doctor_id', doctorId)
      .eq('slot_date', slotDate)
      .eq('start_time', startTime)
      .limit(1);
    if (lookupError) throw lookupError;
    if (existing?.length) continue;

    const { error } = await supabase
      .from('appointment_slots')
      .insert({
        doctor_id: doctorId,
        specialty_id: specialtyId,
        slot_date: slotDate,
        start_time: startTime,
        end_time: endTime,
        capacity: 4,
        booked_count: 0,
        is_active: true,
      });
    if (error) throw error;
  }
}

async function main() {
  if (!hasSupabaseConfig) {
    throw new Error('Backend chưa có SUPABASE_URL hoặc SUPABASE_SERVICE_ROLE_KEY.');
  }

  const firebaseUser = await getOrCreateFirebaseUser();
  const appUserResult = await upsertAppUser(firebaseUser, {
    role: 'doctor',
    allowRoleChange: true,
    status: 'active',
    fullName: TEST_NAME,
    email: TEST_EMAIL,
    emailVerified: true,
    authProvider: 'password',
    markLogin: true,
  });
  if (!appUserResult.ok) throw new Error(appUserResult.data?.message || 'Không thể ghi app_users.');

  const specialty = await getOrCreateSpecialty();
  const doctor = await upsertTestDoctor(firebaseUser.localId, specialty.id);
  await upsertTestWorkspace(firebaseUser, appUserResult.data.id, doctor.id);
  await ensureSlots(doctor.id, specialty.id);

  console.log(`Created provider test account: ${TEST_EMAIL} / ${TEST_PASSWORD}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
